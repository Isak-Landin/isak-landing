// static/js/vps/list.js  (v6)
// Selectable plan cards + sticky CTA w/ interval selector → open mini-cart
// + Footer-overlap guard (keeps CTA above footer at any viewport size)

(function () {
  'use strict';

  const $ = (s, r = document) => r.querySelector(s);
  const $$ = (s, r = document) => Array.from(r.querySelectorAll(s));

  const grid        = $('#plans-grid');
  const cta         = $('#plans-cta');
  const ctaName     = $('#cta-plan-name');
  const ctaMeta     = $('#cta-plan-meta');
  const ctaInterval = $('#cta-interval');
  const ctaOrder    = $('#cta-order');

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
  } catch (_) {/* ignore */}

  let selected = null; // plan_code

  function formatPrice(plan, intervalValue) {
    const isYear = intervalValue === 'year';
    const val = isYear ? plan.priceYear : plan.priceMonth;
    if (val == null) return '—';
    return `${val} ${plan.currency} / ${isYear ? 'year' : 'month'}`;
  }

  function describe(plan, intervalValue) {
    return `${formatPrice(plan, intervalValue)} • ${plan.vcpu} vCPU • ${plan.ram} GB RAM • ${plan.ssd} GB NVMe`;
  }

  function updateCTA() {
    if (!selected || !cta) return;
    const plan = catalog.get(selected);
    if (!plan) return;
    ctaName.textContent = plan.name || '—';
    ctaMeta.textContent = describe(plan, ctaInterval.value);
    cta.hidden = false;
  }

  function clearSelection() {
    $$('.plan-card.is-selected', grid).forEach(el => el.classList.remove('is-selected'));
    $$('.plan-card[aria-selected="true"]', grid).forEach(el => el.setAttribute('aria-selected', 'false'));
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
    selectCard(e.currentTarget);
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
    if (cards.length) selectCard(cards[0]);
  }

  function openCartForSelected() {
    if (!selected) return;
    // Set preferred interval so cart radios sync
    window.VPS_PREF_INTERVAL = ctaInterval.value; // 'month' | 'year'
    if (typeof window._VPS_setInterval === 'function') {
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

  // -------- Keep CTA above footer (no overlap) ----------
  function initCtaFooterGuard() {
    if (!cta) return;

    // Try common footer selectors
    const footer = document.querySelector('footer, .site-footer, #site-footer');
    if (!footer) return;

    const setOffset = (px) => {
      // Lift CTA by footer height + base gap + safe-area
      cta.style.setProperty('--cta-offset', `calc(${px}px + max(16px, env(safe-area-inset-bottom)))`);
    };

    // Observe when footer touches viewport
    const io = new IntersectionObserver((entries) => {
      const entry = entries[0];
      if (!entry) return;
      if (entry.isIntersecting) {
        const rect = footer.getBoundingClientRect();
        setOffset(Math.max(0, Math.round(rect.height)));
      } else {
        // Use CSS default when footer not visible
        cta.style.removeProperty('--cta-offset');
      }
    }, { root: null, threshold: 0 });

    io.observe(footer);

    // On resize/orientation change, if footer is visible, recompute height
    const onResize = () => {
      const rect = footer.getBoundingClientRect();
      if (rect.top < window.innerHeight) {
        setOffset(Math.max(0, Math.round(rect.height)));
      }
    };
    window.addEventListener('resize', onResize);
  }

  document.addEventListener('DOMContentLoaded', () => {
    initSelection();
    wireCTA();
    initCtaFooterGuard();
  });
})();
