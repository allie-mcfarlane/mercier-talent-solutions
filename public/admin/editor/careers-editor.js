(() => {
  'use strict';

  const REPO = 'allie-mcfarlane/mercier-talent-solutions';
  const OWNER = 'allie-mcfarlane';
  const API = '/admin/api/github';
  const AUTH = 'token mts-cloudflare-access';
  const PATH = 'src/content/pages/careers.md';
  const DRAFT_BRANCH = 'cms/visual-careers-page';

  const DEFAULT_APPLICATION_FORM = {
    eyebrow: 'Apply',
    title: 'Submit your application',
    intro: 'Tell us a little about your background, experience and availability, then attach your resume or professional biography. Additional materials are optional.',
    submitLabel: 'Submit application',
    fields: [
      { id: 'name', type: 'text', label: 'Name', required: true, help: '' },
      { id: 'email', type: 'email', label: 'Email', required: true, help: '' },
      { id: 'location', type: 'text', label: 'Location', required: false, help: '' },
      { id: 'relevant-experience', type: 'textarea', label: 'Relevant legal & coaching experience', required: true, help: 'Briefly summarize your legal practice background and experience coaching partners or senior leaders.' },
      { id: 'programs-experience', type: 'textarea', label: 'Programs & leadership development experience', required: false, help: 'You may include training programs, workshops, retreats or other leadership-development work you have designed or led.' },
      { id: 'credentials-education', type: 'textarea', label: 'Coaching credentials & education', required: true, help: 'Include relevant coach training, credentials, education and assessment certifications.' },
      { id: 'interest-in-mercier', type: 'textarea', label: 'Why Mercier Talent Solutions?', required: false, help: 'Tell us briefly what interests you about becoming involved with the firm.' },
      { id: 'availability-arrangements', type: 'textarea', label: 'Availability & preferred professional arrangement', required: false, help: 'Share your general availability and the types of professional arrangements you would be open to considering.' },
      { id: 'additional-notes', type: 'textarea', label: "Anything else you'd like us to know", required: false, help: '' },
      { id: 'resume', type: 'file', label: 'Resume or Professional Biography', required: true, help: 'Attach a PDF or Word document.' },
      { id: 'additional-materials', type: 'file', label: 'Additional Materials', required: false, help: 'Optional: attach one PDF or Word document with any additional information you would like us to consider.' },
    ],
  };

  const app = document.getElementById('app');
  const toastRoot = document.getElementById('toast-root');

  const state = {
    section: 'hero',
    data: null,
    body: '',
    branch: '',
    pr: null,
    dirty: false,
    previewTimer: null,
  };

  const esc = (value = '') => String(value)
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#039;');

  const slugify = (value) => String(value || '')
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');

  const clone = (value) => JSON.parse(JSON.stringify(value));

  const normalizeApplicationForm = (value) => {
    const source = value && typeof value === 'object' ? value : {};
    const fields = Array.isArray(source.fields) && source.fields.length
      ? source.fields
      : clone(DEFAULT_APPLICATION_FORM.fields);

    return {
      eyebrow: String(source.eyebrow ?? DEFAULT_APPLICATION_FORM.eyebrow),
      title: String(source.title ?? DEFAULT_APPLICATION_FORM.title),
      intro: String(source.intro ?? DEFAULT_APPLICATION_FORM.intro),
      submitLabel: String(source.submitLabel ?? DEFAULT_APPLICATION_FORM.submitLabel),
      fields: fields.map((field, index) => ({
        id: slugify(field.id || field.label || `field-${index + 1}`) || `field-${index + 1}`,
        type: ['text', 'textarea', 'email', 'file'].includes(field.type) ? field.type : 'text',
        label: String(field.label || `Field ${index + 1}`),
        required: field.required === true,
        help: String(field.help || ''),
      })),
    };
  };

  const decodeBase64 = (input) => {
    const binary = atob(String(input || '').replace(/\n/g, ''));
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i += 1) bytes[i] = binary.charCodeAt(i);
    return new TextDecoder().decode(bytes);
  };

  const encodeBase64 = (input) => {
    const bytes = new TextEncoder().encode(String(input));
    let binary = '';
    const chunk = 0x8000;
    for (let i = 0; i < bytes.length; i += chunk) {
      binary += String.fromCharCode(...bytes.subarray(i, i + chunk));
    }
    return btoa(binary);
  };

  const api = async (path, options = {}) => {
    const response = await fetch(`${API}/${path}`, {
      ...options,
      headers: {
        Accept: 'application/vnd.github+json',
        Authorization: AUTH,
        ...(options.body ? { 'Content-Type': 'application/json' } : {}),
        ...(options.headers || {}),
      },
    });
    const text = await response.text();
    let payload = null;
    try { payload = text ? JSON.parse(text) : null; } catch { payload = text; }
    if (!response.ok) {
      const error = new Error(payload?.message || `Request failed (${response.status})`);
      error.status = response.status;
      throw error;
    }
    return payload;
  };

  const apiMaybe = async (path, options = {}) => {
    try { return await api(path, options); }
    catch (error) { if (error.status === 404) return null; throw error; }
  };

  const readFile = async (path, ref = 'main') => {
    const result = await apiMaybe(`repos/${REPO}/contents/${path}?ref=${encodeURIComponent(ref)}`);
    if (!result) return null;
    return { text: decodeBase64(result.content), sha: result.sha };
  };

  const parseDocument = (text) => {
    const match = String(text || '').match(/^---\r?\n([\s\S]*?)\r?\n---\r?\n?([\s\S]*)$/);
    if (!match) return { data: {}, body: String(text || '') };
    return {
      data: window.jsyaml.load(match[1], { schema: window.jsyaml.JSON_SCHEMA }) || {},
      body: match[2] || '',
    };
  };

  const serializeDocument = () => {
    const clean = { ...state.data };
    clean.applicationForm = normalizeApplicationForm(clean.applicationForm);
    clean.applicationForm.fields = clean.applicationForm.fields.map((field) => ({
      id: slugify(field.id || field.label),
      type: field.type,
      label: String(field.label || '').trim(),
      required: field.required === true,
      ...(String(field.help || '').trim() ? { help: String(field.help).trim() } : {}),
    }));
    clean.roles = Array.isArray(clean.roles) ? clean.roles.map((role) => ({
      title: String(role.title || '').trim(),
      slug: slugify(role.slug || role.title),
      ...(String(role.location || '').trim() ? { location: String(role.location).trim() } : {}),
      ...(String(role.employmentType || '').trim() ? { employmentType: String(role.employmentType).trim() } : {}),
      ...(String(role.summary || '').trim() ? { summary: String(role.summary).trim() } : {}),
      description: Array.isArray(role.description)
        ? role.description.map((item) => String(item || '').trim()).filter(Boolean)
        : [],
    })) : [];
    const yaml = window.jsyaml.dump(clean, {
      schema: window.jsyaml.JSON_SCHEMA,
      noRefs: true,
      lineWidth: -1,
      sortKeys: false,
      quotingType: '"',
      forceQuotes: false,
    });
    return `---\n${yaml}---\n${state.body || ''}`;
  };

  const getMainRef = () => api(`repos/${REPO}/git/ref/heads/main`);
  const getBranchRef = () => apiMaybe(`repos/${REPO}/git/ref/heads/${DRAFT_BRANCH}`);

  const ensureBranch = async () => {
    const existing = await getBranchRef();
    if (existing) return existing;
    const main = await getMainRef();
    return api(`repos/${REPO}/git/refs`, {
      method: 'POST',
      body: JSON.stringify({ ref: `refs/heads/${DRAFT_BRANCH}`, sha: main.object.sha }),
    });
  };

  const findDraftPr = async () => {
    const pulls = await api(`repos/${REPO}/pulls?state=open&head=${encodeURIComponent(`${OWNER}:${DRAFT_BRANCH}`)}&per_page=10`);
    return Array.isArray(pulls) ? pulls[0] || null : null;
  };

  const saveDraftFile = async (content) => {
    await ensureBranch();
    const existing = await readFile(PATH, DRAFT_BRANCH);
    await api(`repos/${REPO}/contents/${PATH}`, {
      method: 'PUT',
      body: JSON.stringify({
        message: 'Update Careers page',
        content: encodeBase64(content),
        branch: DRAFT_BRANCH,
        ...(existing?.sha ? { sha: existing.sha } : {}),
      }),
    });
    let pr = await findDraftPr();
    if (!pr) {
      pr = await api(`repos/${REPO}/pulls`, {
        method: 'POST',
        body: JSON.stringify({
          title: 'Draft: Careers page',
          head: DRAFT_BRANCH,
          base: 'main',
          body: 'Draft created in the Mercier visual website editor.',
          draft: true,
        }),
      });
    }
    state.branch = DRAFT_BRANCH;
    state.pr = pr;
    return pr;
  };

  const publish = async () => {
    const content = serializeDocument();
    await saveDraftFile(content);
    const result = await api(`repos/${REPO}/pulls/${state.pr.number}/merge`, {
      method: 'PUT',
      body: JSON.stringify({ merge_method: 'squash', commit_title: 'Publish Careers page' }),
    });
    if (!result?.merged) throw new Error(result?.message || 'GitHub did not publish the Careers page.');
    try { await api(`repos/${REPO}/git/refs/heads/${DRAFT_BRANCH}`, { method: 'DELETE' }); } catch (_) {}
    state.branch = '';
    state.pr = null;
  };

  const toast = (message, error = false) => {
    toastRoot.innerHTML = `<div class="ve-toast${error ? ' error' : ''}">${esc(message)}</div>`;
    clearTimeout(toast.timer);
    toast.timer = setTimeout(() => { toastRoot.innerHTML = ''; }, 4200);
  };

  const loading = () => {
    app.innerHTML = '<div class="ve-loading"><div><div class="ve-spinner"></div>Opening Careers page…</div></div>';
  };

  const field = (path, label, value, options = {}) => {
    const hint = options.hint ? `<small>${esc(options.hint)}</small>` : '';
    if (options.type === 'textarea') {
      return `<div class="ve-field"><label>${esc(label)}</label><textarea data-bind="${esc(path)}" rows="${options.rows || 5}">${esc(value ?? '')}</textarea>${hint}</div>`;
    }
    return `<div class="ve-field"><label>${esc(label)}</label><input data-bind="${esc(path)}" type="${esc(options.type || 'text')}" value="${esc(value ?? '')}" />${hint}</div>`;
  };

  const selectField = (path, label, value, options) => `
    <div class="ve-field">
      <label>${esc(label)}</label>
      <select data-bind="${esc(path)}">
        ${options.map(([optionValue, optionLabel]) => `<option value="${esc(optionValue)}"${optionValue === value ? ' selected' : ''}>${esc(optionLabel)}</option>`).join('')}
      </select>
    </div>`;

  const getPath = (root, path) => String(path).split('.').reduce((value, key) => value == null ? undefined : value[key], root);
  const setPath = (root, path, value) => {
    const parts = String(path).split('.');
    let target = root;
    parts.slice(0, -1).forEach((part, index) => {
      const next = parts[index + 1];
      if (target[part] == null) target[part] = /^\d+$/.test(next) ? [] : {};
      target = target[part];
    });
    target[parts.at(-1)] = value;
  };

  const markDirty = () => {
    state.dirty = true;
    window.__MTS_CAREERS_APPLICATION_FORM__ = state.data.applicationForm;
    const status = document.getElementById('careers-status');
    if (status) {
      status.className = 've-status changed';
      status.textContent = 'Unsaved changes';
    }
    schedulePreview();
  };

  const styles = `
    <style>
      .careers-editor-note{margin:0 0 18px;padding:12px 14px;border:1px solid #dce3ea;border-radius:9px;background:#f7f9fb;color:#596675;font-size:12px;line-height:1.55}
      .careers-role-actions,.careers-form-actions{display:flex;gap:7px;flex-wrap:wrap}
      .careers-role-actions button,.careers-form-actions button{border:1px solid #d7dce2;background:#fff;border-radius:7px;padding:7px 9px;color:#44515f;font-size:11px;font-weight:700;cursor:pointer}
      .careers-role-actions button:hover,.careers-form-actions button:hover{border-color:#45628e;color:#1a2b46}
      .careers-role-actions .danger:hover,.careers-form-actions .danger:hover{border-color:#a84b4b;color:#8d3131}
      .careers-add-role,.careers-add-field{width:100%;margin-top:12px}
      .careers-description textarea{min-height:210px}
      .careers-editor .ve-list-item summary{cursor:pointer}
      .careers-editor .ve-list-item summary::-webkit-details-marker{display:none}
      .careers-editor .ve-list-item[open] summary{margin-bottom:14px}
      .careers-empty{padding:24px;border:1px dashed #ccd4dd;border-radius:10px;text-align:center;color:#66707c;background:#fafbfc}
      .careers-form-field{padding:16px;border:1px solid #dce2e8;border-radius:10px;background:#fbfcfd}
      .careers-form-field+.careers-form-field{margin-top:12px}
      .careers-form-field-head{display:flex;align-items:center;justify-content:space-between;gap:12px;margin-bottom:14px}
      .careers-form-field-head strong{color:#1a2b46;font-size:13px}
      .careers-required{display:flex;align-items:center;gap:8px;margin:4px 0 14px;color:#44515f;font-size:12px;font-weight:700}
      .careers-required input{width:16px;height:16px;margin:0}
      .careers-form-help{margin:0 0 16px;color:#66707c;font-size:12px;line-height:1.55}
      .ve-field select{width:100%;min-height:42px;border:1px solid #cfd6de;border-radius:7px;background:#fff;padding:8px 10px;color:#273442;font:inherit}
      @media(max-width:900px){.careers-role-actions,.careers-form-actions{margin-top:8px}.careers-form-field-head{align-items:flex-start;flex-direction:column}}
    </style>`;

  const sectionTitle = () => state.section === 'hero' ? 'Hero' : state.section === 'roles' ? 'Open Roles' : 'Application Form';
  const sectionDescription = () => state.section === 'hero'
    ? 'Edit the heading at the top of the Careers page.'
    : state.section === 'roles'
      ? 'Each role becomes a link on Careers and opens its own role-description page.'
      : 'Edit the application heading and manage the questions candidates complete.';

  const shell = (formHtml) => `
    ${styles}
    <div class="ve-shell careers-editor">
      <header class="ve-topbar">
        <div class="ve-brand-row">
          <a class="ve-brand" href="/admin/editor/#/">
            <img src="/images/mercier-logo-color.png" alt="Mercier Talent Solutions" />
            <span class="ve-brand-copy"><strong>Website Editor</strong><span>Mercier Talent Solutions</span></span>
          </a>
          <div class="ve-actions">
            <span class="ve-draft-pill">Draft mode</span>
            <a href="/careers/" target="_blank" rel="noopener">View Careers ↗</a>
          </div>
        </div>
        <nav class="ve-nav" aria-label="Website editor navigation">
          <a href="/admin/editor/#/">Home</a>
          <a class="active" href="/admin/editor/#/pages">Pages</a>
          <a href="/admin/editor/#/blog">Blog Posts</a>
          <a href="/admin/editor/whitepapers.html">White Papers</a>
          <a href="/admin/#/media">Media Assets</a>
          <a href="/admin/#/collections/navigation/entries/main">Top Menu</a>
          <a href="/admin/#/collections/settings/entries/appearance">Design</a>
        </nav>
      </header>

      <main class="ve-editor">
        <aside class="ve-sidebar">
          <a class="ve-sidebar-back" href="/admin/editor/#/pages">← Back to Pages</a>
          <h2>Careers</h2>
          <p>Edit the Careers page, role descriptions and candidate application form.</p>
          <div class="ve-section-list">
            <button class="ve-section-button${state.section === 'hero' ? ' active' : ''}" type="button" data-section="hero">
              <strong>Hero</strong><span>Careers label and “Join our team” heading.</span>
            </button>
            <button class="ve-section-button${state.section === 'roles' ? ' active' : ''}" type="button" data-section="roles">
              <strong>Open Roles</strong><span>Add, edit, reorder or remove role descriptions.</span>
            </button>
            <button class="ve-section-button${state.section === 'form' ? ' active' : ''}" type="button" data-section="form">
              <strong>Application Form</strong><span>Change headings, questions, requirements and uploads.</span>
            </button>
          </div>
        </aside>

        <section class="ve-editor-pane">
          <div class="ve-editor-head">
            <div>
              <span class="ve-eyebrow">Edit page</span>
              <h1>${sectionTitle()}</h1>
              <p>${sectionDescription()}</p>
            </div>
            <div class="ve-editor-actions">
              <button class="ve-button" type="button" data-action="save">Save draft</button>
              <button class="ve-button primary" type="button" data-action="publish">Publish</button>
            </div>
          </div>
          <p class="careers-editor-note"><strong>Save Draft</strong> keeps changes private. <strong>Publish</strong> updates the live website.</p>
          <div class="ve-form">${formHtml}</div>
        </section>

        <aside class="ve-preview-pane">
          <div class="ve-preview-bar">
            <div><strong>Website preview</strong><span>This updates while you edit. Nothing is live until you publish.</span></div>
            <span id="careers-status" class="ve-status${state.dirty ? ' changed' : ''}">${state.dirty ? 'Unsaved changes' : state.branch ? 'Draft loaded' : 'Current site'}</span>
          </div>
          <iframe id="careers-preview" class="ve-preview-frame" src="/careers/" title="Careers page preview"></iframe>
        </aside>
      </main>
    </div>`;

  const heroForm = () => [
    field('eyebrow', 'Small heading', state.data.eyebrow || ''),
    field('title', 'Main title', state.data.title || ''),
    field('titleAccent', 'Blue italic word', state.data.titleAccent || ''),
    field('lede', 'Intro text (optional)', state.data.lede || '', { type: 'textarea', rows: 5, hint: 'Leave blank if you only want the title.' }),
  ].join('');

  const roleForm = () => {
    const roles = state.data.roles || (state.data.roles = []);
    const list = roles.length ? roles.map((role, index) => `
      <details class="ve-list-item" ${index === 0 ? 'open' : ''}>
        <summary class="ve-list-item-head">
          <strong>${esc(role.title || `Role ${index + 1}`)}</strong>
          <span style="color:#7a8796;font-size:10px">Click to edit</span>
        </summary>
        <div class="ve-form">
          ${field(`roles.${index}.title`, 'Role title', role.title || '', { hint: 'This is the clickable heading on the Careers page.' })}
          ${field(`roles.${index}.slug`, 'Page address', role.slug || '', { hint: 'Example: director-of-client-development. The page will be /careers/page-address/.' })}
          <div class="ve-inline-fields">
            ${field(`roles.${index}.location`, 'Location (optional)', role.location || '')}
            ${field(`roles.${index}.employmentType`, 'Employment type (optional)', role.employmentType || '', { hint: 'Example: Full-time, Part-time or Contract.' })}
          </div>
          ${field(`roles.${index}.summary`, 'Short role summary (optional)', role.summary || '', { type: 'textarea', rows: 4, hint: 'Shown prominently at the top of the individual role page.' })}
          <div class="ve-field careers-description">
            <label>Role description</label>
            <textarea data-description="${index}" rows="10">${esc((role.description || []).join('\n\n'))}</textarea>
            <small>Separate paragraphs with a blank line.</small>
          </div>
          <div class="careers-role-actions">
            <button type="button" data-move-role="up" data-index="${index}"${index === 0 ? ' disabled' : ''}>Move up</button>
            <button type="button" data-move-role="down" data-index="${index}"${index === roles.length - 1 ? ' disabled' : ''}>Move down</button>
            <button class="danger" type="button" data-delete-role data-index="${index}">Delete role</button>
          </div>
        </div>
      </details>`).join('') : '<div class="careers-empty"><strong>No roles added yet.</strong><br>Add a role when you have an opening to publish.</div>';

    return `
      ${field('rolesHeading', 'Section heading', state.data.rolesHeading || 'Open Roles')}
      <div class="ve-list">${list}</div>
      <button class="ve-button primary careers-add-role" type="button" data-add-role>Add Role</button>`;
  };

  const applicationFormEditor = () => {
    const form = state.data.applicationForm;
    const fields = form.fields || (form.fields = []);
    const list = fields.length ? fields.map((item, index) => `
      <div class="careers-form-field">
        <div class="careers-form-field-head">
          <strong>${esc(item.label || `Field ${index + 1}`)}</strong>
          <span style="color:#7a8796;font-size:10px">${item.required ? 'Required' : 'Optional'} · ${item.type === 'textarea' ? 'Long answer' : item.type === 'file' ? 'File upload' : item.type === 'email' ? 'Email' : 'Short answer'}</span>
        </div>
        ${field(`applicationForm.fields.${index}.label`, 'Field label', item.label || '')}
        ${selectField(`applicationForm.fields.${index}.type`, 'Field type', item.type || 'text', [
          ['text', 'Short answer'],
          ['textarea', 'Long answer'],
          ['email', 'Email address'],
          ['file', 'File upload (PDF or Word)'],
        ])}
        <label class="careers-required">
          <input type="checkbox" data-bind="applicationForm.fields.${index}.required"${item.required ? ' checked' : ''} />
          Required field
        </label>
        ${field(`applicationForm.fields.${index}.help`, 'Help text (optional)', item.help || '', { type: 'textarea', rows: 3, hint: 'This appears below the field to guide the applicant.' })}
        <div class="careers-form-actions">
          <button type="button" data-move-form-field="up" data-index="${index}"${index === 0 ? ' disabled' : ''}>Move up</button>
          <button type="button" data-move-form-field="down" data-index="${index}"${index === fields.length - 1 ? ' disabled' : ''}>Move down</button>
          <button class="danger" type="button" data-delete-form-field data-index="${index}">Delete field</button>
        </div>
      </div>`).join('') : '<div class="careers-empty"><strong>No application fields.</strong><br>Add a field below. The security check and Submit button are kept automatically.</div>';

    return `
      ${field('applicationForm.eyebrow', 'Small heading', form.eyebrow || '')}
      ${field('applicationForm.title', 'Form heading', form.title || '')}
      ${field('applicationForm.intro', 'Intro text (optional)', form.intro || '', { type: 'textarea', rows: 4 })}
      ${field('applicationForm.submitLabel', 'Submit button text', form.submitLabel || '')}
      <p class="careers-form-help">Application fields appear on every current job posting. Required fields show an asterisk to applicants. The security check cannot be removed accidentally.</p>
      <div class="careers-form-list">${list}</div>
      <button class="ve-button primary careers-add-field" type="button" data-add-form-field>Add Form Field</button>`;
  };

  const render = () => {
    state.data.applicationForm = normalizeApplicationForm(state.data.applicationForm);
    window.__MTS_CAREERS_APPLICATION_FORM__ = state.data.applicationForm;
    const formHtml = state.section === 'hero'
      ? heroForm()
      : state.section === 'roles'
        ? roleForm()
        : applicationFormEditor();
    app.innerHTML = shell(formHtml);
    bind();
    bindPreview();
  };

  const bind = () => {
    document.querySelectorAll('[data-section]').forEach((button) => button.addEventListener('click', () => {
      state.section = button.dataset.section;
      render();
    }));

    document.querySelectorAll('[data-bind]').forEach((input) => {
      const update = () => {
        const path = input.dataset.bind;
        const before = getPath(state.data, path);
        const nextValue = input.type === 'checkbox' ? input.checked : input.value;
        setPath(state.data, path, nextValue);
        if (/^roles\.\d+\.title$/.test(path)) {
          const index = Number(path.split('.')[1]);
          const slugPath = `roles.${index}.slug`;
          const currentSlug = getPath(state.data, slugPath);
          if (!currentSlug || /^new-role(?:-\d+)?$/.test(currentSlug) || currentSlug === slugify(before)) {
            setPath(state.data, slugPath, slugify(input.value));
          }
        }
        markDirty();
      };
      input.addEventListener(input.type === 'checkbox' || input.tagName === 'SELECT' ? 'change' : 'input', update);
    });

    document.querySelectorAll('[data-description]').forEach((textarea) => textarea.addEventListener('input', () => {
      const index = Number(textarea.dataset.description);
      state.data.roles[index].description = textarea.value
        .split(/\n\s*\n/)
        .map((item) => item.trim())
        .filter(Boolean);
      markDirty();
    }));

    document.querySelector('[data-add-role]')?.addEventListener('click', () => {
      const roles = state.data.roles || (state.data.roles = []);
      const suffix = roles.length + 1;
      roles.push({
        title: 'New Role',
        slug: `new-role-${suffix}`,
        location: '',
        employmentType: '',
        summary: '',
        description: [],
      });
      state.dirty = true;
      render();
      setTimeout(() => document.querySelector('.ve-list-item:last-of-type')?.scrollIntoView({ behavior: 'smooth', block: 'center' }), 60);
    });

    document.querySelectorAll('[data-delete-role]').forEach((button) => button.addEventListener('click', () => {
      const index = Number(button.dataset.index);
      const role = state.data.roles[index];
      if (!confirm(`Delete ${role?.title || 'this role'} from the draft?`)) return;
      state.data.roles.splice(index, 1);
      state.dirty = true;
      render();
    }));

    document.querySelectorAll('[data-move-role]').forEach((button) => button.addEventListener('click', () => {
      const index = Number(button.dataset.index);
      const direction = button.dataset.moveRole === 'up' ? -1 : 1;
      const next = index + direction;
      if (next < 0 || next >= state.data.roles.length) return;
      [state.data.roles[index], state.data.roles[next]] = [state.data.roles[next], state.data.roles[index]];
      state.dirty = true;
      render();
    }));

    document.querySelector('[data-add-form-field]')?.addEventListener('click', () => {
      const fields = state.data.applicationForm.fields;
      let id = `question-${Date.now().toString(36)}`;
      while (fields.some((field) => field.id === id)) id = `${id}-2`;
      fields.push({ id, type: 'textarea', label: 'New question', required: false, help: '' });
      state.dirty = true;
      render();
      setTimeout(() => document.querySelector('.careers-form-field:last-of-type')?.scrollIntoView({ behavior: 'smooth', block: 'center' }), 60);
    });

    document.querySelectorAll('[data-delete-form-field]').forEach((button) => button.addEventListener('click', () => {
      const index = Number(button.dataset.index);
      const item = state.data.applicationForm.fields[index];
      if (!confirm(`Delete ${item?.label || 'this field'} from the application form?`)) return;
      state.data.applicationForm.fields.splice(index, 1);
      state.dirty = true;
      render();
    }));

    document.querySelectorAll('[data-move-form-field]').forEach((button) => button.addEventListener('click', () => {
      const index = Number(button.dataset.index);
      const direction = button.dataset.moveFormField === 'up' ? -1 : 1;
      const next = index + direction;
      const fields = state.data.applicationForm.fields;
      if (next < 0 || next >= fields.length) return;
      [fields[index], fields[next]] = [fields[next], fields[index]];
      state.dirty = true;
      render();
    }));

    document.querySelector('[data-action="save"]')?.addEventListener('click', () => save(false));
    document.querySelector('[data-action="publish"]')?.addEventListener('click', () => save(true));
  };

  const save = async (shouldPublish) => {
    const buttons = document.querySelectorAll('[data-action="save"],[data-action="publish"]');
    buttons.forEach((button) => { button.disabled = true; });
    try {
      const duplicateSlugs = new Set();
      const seen = new Set();
      for (const role of state.data.roles || []) {
        const slug = slugify(role.slug || role.title);
        if (!role.title?.trim()) throw new Error('Every role needs a role title.');
        if (!slug) throw new Error(`Add a page address for ${role.title}.`);
        if (seen.has(slug)) duplicateSlugs.add(slug);
        seen.add(slug);
        role.slug = slug;
      }
      if (duplicateSlugs.size) throw new Error('Each role needs a different page address.');

      const fields = state.data.applicationForm.fields || [];
      const fieldIds = new Set();
      for (const field of fields) {
        field.label = String(field.label || '').trim();
        if (!field.label) throw new Error('Every application field needs a label.');
        field.id = slugify(field.id || field.label);
        if (!field.id) throw new Error(`Add a label for ${field.label || 'each application field'}.`);
        if (fieldIds.has(field.id)) field.id = `${field.id}-${fieldIds.size + 1}`;
        fieldIds.add(field.id);
      }

      if (shouldPublish) {
        if (!confirm('Publish these Careers changes to the live website?')) return;
        await publish();
        state.dirty = false;
        toast('Published. The Careers page is updating on the live website.');
      } else {
        await saveDraftFile(serializeDocument());
        state.dirty = false;
        toast('Draft saved. Nothing is live yet.');
      }
      render();
    } catch (error) {
      toast(error.message || 'Could not save Careers.', true);
    } finally {
      document.querySelectorAll('[data-action="save"],[data-action="publish"]').forEach((button) => { button.disabled = false; });
    }
  };

  const requestFormPreview = () => {
    if (state.section !== 'form' || !(state.data.roles || []).length) return;
    window.__MTS_CAREERS_APPLICATION_FORM__ = state.data.applicationForm;
    document.dispatchEvent(new CustomEvent('mts:preview-career-role', { detail: { index: 0 } }));
  };

  const bindPreview = () => {
    const frame = document.getElementById('careers-preview');
    if (!frame) return;
    const sync = () => {
      patchPreview(frame);
      setTimeout(requestFormPreview, 160);
    };
    frame.addEventListener('load', () => setTimeout(sync, 80));
    setTimeout(sync, 120);
  };

  const schedulePreview = () => {
    clearTimeout(state.previewTimer);
    state.previewTimer = setTimeout(() => {
      const frame = document.getElementById('careers-preview');
      if (frame) patchPreview(frame);
      requestFormPreview();
    }, 100);
  };

  const patchPreview = (frame) => {
    try {
      const doc = frame.contentDocument;
      if (!doc || doc.readyState === 'loading' || doc.querySelector('.mts-draft-role')) return;
      const text = (selector, value) => {
        const node = doc.querySelector(selector);
        if (node) node.textContent = value || '';
      };
      text('.careers-hero .eyebrow', state.data.eyebrow);
      text('.careers-hero h1 span', state.data.title);
      text('.careers-hero h1 em', state.data.titleAccent);
      text('.roles-label', state.data.rolesHeading || 'Open Roles');

      let lede = doc.querySelector('.careers-lede');
      if (state.data.lede) {
        if (!lede) {
          lede = doc.createElement('p');
          lede.className = 'careers-lede';
          doc.querySelector('.careers-hero h1')?.after(lede);
        }
        lede.textContent = state.data.lede;
        lede.style.display = '';
      } else if (lede) {
        lede.style.display = 'none';
      }

      const shell = doc.querySelector('.roles-shell');
      if (!shell) return;
      shell.querySelector('.role-list,.roles-empty')?.remove();
      if ((state.data.roles || []).length) {
        const list = doc.createElement('div');
        list.className = 'role-list';
        list.innerHTML = state.data.roles.map((role) => `
          <a class="role-link" href="/careers/${esc(slugify(role.slug || role.title))}/">
            <div>
              <h2>${esc(role.title || 'New Role')}</h2>
              ${(role.location || role.employmentType) ? `<p>${esc([role.location, role.employmentType].filter(Boolean).join(' · '))}</p>` : ''}
            </div>
            <span aria-hidden="true">→</span>
          </a>`).join('');
        shell.append(list);
      } else {
        const empty = doc.createElement('div');
        empty.className = 'roles-empty';
        empty.innerHTML = '<p>No roles are currently listed here.</p>';
        shell.append(empty);
      }
    } catch (_) {}
  };

  const load = async () => {
    loading();
    try {
      const branch = await getBranchRef();
      const source = await readFile(PATH, branch ? DRAFT_BRANCH : 'main');
      if (!source) throw new Error('Careers content could not be found.');
      const parsed = parseDocument(source.text);
      state.data = parsed.data;
      state.body = parsed.body;
      state.data.roles ||= [];
      state.data.rolesHeading ||= 'Open Roles';
      state.data.applicationForm = normalizeApplicationForm(state.data.applicationForm);
      window.__MTS_CAREERS_APPLICATION_FORM__ = state.data.applicationForm;
      state.branch = branch ? DRAFT_BRANCH : '';
      state.pr = branch ? await findDraftPr() : null;
      state.dirty = false;
      render();
    } catch (error) {
      app.innerHTML = `<div class="ve-empty"><div><h2>Careers editor could not open</h2><p>${esc(error.message)}</p><p><a href="/admin/editor/#/pages">Back to Pages</a></p></div></div>`;
    }
  };

  window.addEventListener('beforeunload', (event) => {
    if (!state.dirty) return;
    event.preventDefault();
    event.returnValue = '';
  });

  load();
})();