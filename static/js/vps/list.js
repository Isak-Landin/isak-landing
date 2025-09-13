// static/js/vps/list.js  (v5)
// Selectable plan cards + sticky CTA w/ interval selector → open mini-cart

(function () {
  'use strict';

  const $ = (s, r = document) => r.querySelector(s);
  const $$ = (s, r = document) => Array.from(r.querySelectorAll(s));

  const grid = $('#plans-grid');
  const cta = $('#plans-cta');
  const ctaName = $('#cta-plan-name');
  const ctaMeta = $('#cta-plan-meta');
  const ctaInterval = $('#cta-interval');
  const ctaOrder = $('#cta-order');

  // Build catalog from inline JSON
  const catTag = $('#vps-catalog');
  const catalog = new Map();
  try {
    const arr = JSON.parse(catTag?.textContent || '[]');
    arr.forEach(p => {
      catalog.set(p.plan_code, {
        code: p.plan_code,
        name: p.name,
        vcpu: p.vcpu,
        ram: p.ram_gb,
        ssd: p.ssd_gb,
        bw: p.bandwidth_tb,
        priceMonth: p.price_month,
        priceYear: p.price_year,
        currency: (p.currency || 'EUR').toUpperCase()
      });
    });
  } catch (_) {}

  let selected = null; // plan_code

  function formatPrice(plan, interval) {
    const val = interval === 'year' ? plan.priceYear : plan.priceMonth;
    if (val == null) return '—';
    // keep your current formatting (server-side numbers); simple locale-ish display:
    return `${val} ${plan.currency} / ${interval === 'year' ? 'year' : 'month'}`;
  }

  function describe(plan, interval) {
    return `${formatPrice(plan, interval)} • ${plan.vcpu} vCPU • ${plan.ram} GB RAM • ${plan.ssd} GB NVMe`;
  }

  function updateCTA() {
    if (!selected || !cta) return;
    const plan = catalog.get(selected);
    if (!plan) return;
    ctaName.textContent = plan.name;
    ctaMeta.textContent = describe(plan, ctaInterval.value);
    cta.hidden = false;
  }

  function clearSelection() {
    $$('.plan-card.is-selected', grid).forEach(el => el.classList.remove('is-selected'));
    const opts = $$('.plan-card[aria-selected="true"]', grid);
    opts.forEach(el => el.setAttribute('aria-selected', 'false'));
  }

  function selectCard(el) {
    if (!el) return;
    const code = el.getAttribute('data-plan');
    if (!code || !catalog.has(code)) return;

    clearSelection();
    el.classList.add('is-selected');
    el.setAttribute('aria-selected', 'true');
    selected = code;
    updateCTA();
  }

  function handleCardClick(e) {
    const card = e.currentTarget;
    selectCard(card);
    // optional: scroll CTA into view on mobile
    if (window.innerWidth < 700) {
      cta?.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    }
  }

  function handleCardKey(e) {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      selectCard(e.currentTarget);
    }
  }

  function initSelection() {
    const cards = $$('.plan-card[data-plan]', grid);
    cards.forEach(card => {
      card.addEventListener('click', handleCardClick);
      card.addEventListener('keydown', handleCardKey);
    });
    // Auto-select the first plan
    if (cards.length) selectCard(cards[0]);
  }

  function openCartForSelected() {
    if (!selected) return;
    // Set preferred interval so cart radios sync
    window.VPS_PREF_INTERVAL = ctaInterval.value; // 'month' | 'year'
    if (typeof window._VPS_setInterval === 'function') {
      // If cart.js patch present, set immediately
      window._VPS_setInterval(ctaInterval.value);
    }
    // Reuse existing hidden button so cart.js flow remains untouched
    const btn = document.querySelector(`.plan-btn[data-plan="${CSS.escape(selected)}"]`);
    if (btn) btn.click();
  }

  function wireCTA() {
    if (!cta) return;
    ctaInterval.addEventListener('change', updateCTA);
    ctaOrder.addEventListener('click', openCartForSelected);
  }

  document.addEventListener('DOMContentLoaded', () => {
    initSelection();
    wireCTA();
  });
})();
