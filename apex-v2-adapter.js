(() => {
  'use strict';

  const MARKER = 'KPS_MENU_APEX_V2';
  if (window[MARKER]) return;
  window[MARKER] = true;

  const APEX_API_BASE = (document.querySelector('meta[name="kps-apex-api"]')?.content || 'https://kps-apex-os-v507-test.onrender.com').replace(/\/$/, '');
  const APEX_CATALOG_URL = `${APEX_API_BASE}/api/public/v2/catalog/branch`;

  const normalize = (value) => String(value || '')
    .replace(/[\u064B-\u065F\u0670]/g, '')
    .replace(/[إأآ]/g, 'ا')
    .replace(/ة/g, 'ه')
    .replace(/ى/g, 'ي')
    .replace(/[^\u0600-\u06FFa-zA-Z0-9]+/g, '')
    .toLowerCase();

  const absoluteApexUrl = (path) => {
    if (!path) return '';
    try { return new URL(path, `${APEX_API_BASE}/`).href; }
    catch (_) { return ''; }
  };

  const money = (halalas) => `${(Number(halalas || 0) / 100).toFixed(2)} ر.س`;

  const productNodes = () => [...document.querySelectorAll(
    'article.product, article.card, .product-card, .menu-item, [data-product-name]'
  )].filter((node) => node.querySelector('h2,h3,h4,.product-name,.name'));

  const titleNode = (node) => node.querySelector('h3,h2,h4,.product-name,.name');
  const priceNode = (node) => node.querySelector('.price,.product-price,.info > span,.info span,[data-price]');

  const readProductName = (node) => node.dataset.productName || titleNode(node)?.textContent || '';
  const readProductCode = (node) => node.dataset.apexProductCode || node.dataset.productCode || '';

  const setImage = (node, item) => {
    const url = absoluteApexUrl(item.image_url);
    if (!url) return;
    let image = node.querySelector('img');
    if (!image) {
      image = document.createElement('img');
      image.loading = 'lazy';
      node.prepend(image);
    }
    image.src = url;
    image.alt = item.name || 'KPS COFFEE';
  };

  const setPrice = (node, item) => {
    const target = priceNode(node);
    if (!target) return;
    const current = Number(item.price_halalas || 0);
    const base = Number(item.base_price_halalas ?? current);
    target.textContent = '';
    if (Number(item.discount_halalas || 0) > 0 && base > current) {
      const old = document.createElement('s');
      old.textContent = money(base);
      old.style.marginInlineEnd = '8px';
      old.style.opacity = '.6';
      const live = document.createElement('b');
      live.textContent = money(current);
      const badge = document.createElement('small');
      badge.textContent = item.offer?.label || 'عرض';
      badge.style.cssText = 'display:block;width:max-content;margin-top:4px;padding:3px 8px;border-radius:999px;background:#f26532;color:#fff;font-weight:900';
      target.append(old, live, badge);
    } else {
      target.textContent = money(current);
    }
  };

  const findSectionForCategory = (category) => {
    const wanted = normalize(category);
    if (!wanted) return null;
    return [...document.querySelectorAll('section, .section, .category')].find((section) => {
      const heading = section.querySelector('h1,h2,h3,.section-title,.category-title');
      return heading && normalize(heading.textContent).includes(wanted);
    }) || null;
  };

  const cloneForNewItem = (item, allNodes) => {
    const section = findSectionForCategory(item.category);
    const host = section?.querySelector('.grid,.products,.menu-grid,.items') || section;
    const source = allNodes.find((node) => {
      const parentSection = node.closest('section,.section,.category');
      return !section || parentSection === section;
    }) || allNodes[0];
    if (!source || !host) return null;
    const clone = source.cloneNode(true);
    clone.hidden = false;
    clone.removeAttribute('id');
    host.appendChild(clone);
    return clone;
  };

  const paintItem = (node, item) => {
    node.hidden = false;
    node.dataset.apexManaged = '1';
    node.dataset.apexProductCode = String(item.code || '');
    node.dataset.productName = String(item.name || '');
    const title = titleNode(node);
    if (title) title.textContent = item.name || '';
    setImage(node, item);
    setPrice(node, item);
  };

  const ensureStatus = () => {
    let node = document.getElementById('kpsApexMenuStatus');
    if (node) return node;
    node = document.createElement('div');
    node.id = 'kpsApexMenuStatus';
    node.setAttribute('role', 'status');
    node.style.cssText = 'position:fixed;z-index:99999;inset-inline:12px;bottom:12px;max-width:520px;margin:auto;padding:8px 12px;border-radius:12px;background:rgba(15,15,15,.92);border:1px solid rgba(242,101,50,.42);color:#ddd;text-align:center;font:800 12px/1.5 system-ui;box-shadow:0 8px 30px rgba(0,0,0,.25)';
    document.body.appendChild(node);
    return node;
  };

  const setStatus = (message, ok = false) => {
    const node = ensureStatus();
    node.textContent = message;
    node.style.borderColor = ok ? 'rgba(70,200,120,.55)' : 'rgba(242,101,50,.42)';
    if (ok) setTimeout(() => { node.style.opacity = '.35'; }, 2500);
  };

  const syncFromApex = async () => {
    setStatus('جاري تحديث المنيو والصور والأسعار من KPS APEX…');
    try {
      const response = await fetch(APEX_CATALOG_URL, { headers: { Accept: 'application/json' }, cache: 'no-store' });
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      const payload = await response.json();
      if (!payload?.ok || !Array.isArray(payload.items)) throw new Error('invalid payload');

      const initialNodes = productNodes();
      const byCode = new Map(initialNodes.filter((node) => readProductCode(node)).map((node) => [String(readProductCode(node)), node]));
      const byName = new Map(initialNodes.map((node) => [normalize(readProductName(node)), node]));
      const used = new Set();

      for (const item of payload.items) {
        let node = byCode.get(String(item.code || '')) || byName.get(normalize(item.name));
        if (!node) node = cloneForNewItem(item, initialNodes);
        if (!node) continue;
        paintItem(node, item);
        used.add(node);
      }

      initialNodes.forEach((node) => {
        if (!used.has(node)) node.hidden = true;
      });

      document.documentElement.dataset.apexMenuVersion = String(payload.menu_version || 0);
      setStatus(`تم تحديث المنيو من KPS APEX • النسخة ${payload.menu_version || 0}`, true);
    } catch (error) {
      console.error('[KPS MENU APEX V2]', error);
      setStatus('تعذر تحديث المنيو من KPS APEX — لم يتم نشر أي تغيير محلي');
    }
  };

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', syncFromApex, { once: true });
  } else {
    syncFromApex();
  }
})();
