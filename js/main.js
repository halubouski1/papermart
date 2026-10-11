/* =========================================================
   PaperMart — page scripts
   ========================================================= */
(function () {
  'use strict';

  document.addEventListener('DOMContentLoaded', function () {
    initHeroSlider();
    initCart();
    initCatalog();
    initFilterToggles();
    initEnquiryForm();
  });

  /* ---------- 1. Hero slider (Swiper) ---------- */
  function initHeroSlider() {
    var el = document.querySelector('[data-hero-slider]');
    if (!el || typeof Swiper === 'undefined') return;

    new Swiper(el, {
      loop: true,
      speed: 700,
      grabCursor: true,
      autoplay: { delay: 6000, disableOnInteraction: false, pauseOnMouseEnter: true },
      navigation: {
        prevEl: '[data-hero-prev]',
        nextEl: '[data-hero-next]'
      },
      pagination: {
        el: '[data-hero-pagination]',
        clickable: true,
        bulletElement: 'button'
      },
      a11y: {
        prevSlideMessage: 'Previous slide',
        nextSlideMessage: 'Next slide',
        paginationBulletMessage: 'Go to slide {{index}}'
      }
    });
  }

  /* ---------- 2. Cart UI state ---------- */
  var cart = { count: 2, total: 89.90, currency: 'AUD' };

  function formatPrice(value, currency) {
    return '$' + value.toFixed(2) + ' ' + currency;
  }

  function renderCart() {
    document.querySelectorAll('[data-cart-count]').forEach(function (badge) {
      badge.textContent = cart.count;
      badge.toggleAttribute('data-empty', cart.count === 0);
    });
    document.querySelectorAll('[data-cart-total]').forEach(function (total) {
      total.textContent = formatPrice(cart.total, cart.currency);
    });
    document.querySelectorAll('[data-cart]').forEach(function (link) {
      link.setAttribute('aria-label', 'Shopping cart, ' + cart.count + ' items, ' + formatPrice(cart.total, cart.currency));
    });
  }

  /** Public helper: window.PaperMartCart.update({ count: 3, total: 135.85 }) */
  function updateCart(next) {
    if (typeof next.count === 'number') cart.count = Math.max(0, next.count);
    if (typeof next.total === 'number') cart.total = Math.max(0, next.total);
    renderCart();
  }

  function initCart() {
    window.PaperMartCart = { update: updateCart, get: function () { return Object.assign({}, cart); } };
    renderCart();
  }

  /* ---------- 3–5. Catalog: filtering, sorting, view more ---------- */
  var INITIAL_LIMIT = 8; // 8 products + the Custom Grid card = 9 cards (3 × 3), as in Figma

  function initCatalog() {
    var grid = document.querySelector('[data-product-grid]');
    var form = document.querySelector('[data-filters]');
    if (!grid || !form) return;

    var products = Array.prototype.slice.call(grid.querySelectorAll('[data-product]'));
    var customCard = grid.querySelector('[data-custom-card]');
    var sortSelect = document.querySelector('[data-sort]');
    var moreBtn = document.querySelector('[data-view-more]');
    var moreWrap = moreBtn ? moreBtn.parentElement : null;
    var status = document.querySelector('[data-catalog-status]');
    var empty = document.querySelector('[data-catalog-empty]');
    var clearBtn = document.querySelector('[data-filters-clear]');

    var state = { expanded: false, sort: 'popular' };

    function getActiveFilters() {
      var active = {};
      form.querySelectorAll('input[type="checkbox"]:checked').forEach(function (input) {
        (active[input.name] = active[input.name] || []).push(input.value);
      });
      return active;
    }

    // OR inside one group, AND between groups
    function matches(product, active) {
      return Object.keys(active).every(function (group) {
        var values = (product.dataset[group] || '').split(' ');
        return active[group].some(function (v) { return values.indexOf(v) !== -1; });
      });
    }

    function compare(a, b) {
      var pa = parseFloat(a.dataset.price), pb = parseFloat(b.dataset.price);
      var ra = parseInt(a.dataset.popularity, 10), rb = parseInt(b.dataset.popularity, 10);
      if (state.sort === 'price-asc') return pa - pb || ra - rb;
      if (state.sort === 'price-desc') return pb - pa || ra - rb;
      return ra - rb;
    }

    function render() {
      var active = getActiveFilters();
      var hasFilters = Object.keys(active).length > 0;
      var visible = products.filter(function (p) { return matches(p, active); }).sort(compare);

      // reorder DOM: matched products first in sort order, custom card always last
      visible.forEach(function (p) { grid.insertBefore(p, customCard); });

      products.forEach(function (p) { p.hidden = true; });
      visible.forEach(function (p, i) { p.hidden = !state.expanded && i >= INITIAL_LIMIT; });

      if (moreWrap) moreWrap.hidden = state.expanded || visible.length <= INITIAL_LIMIT;
      if (empty) empty.hidden = visible.length > 0;
      if (status) {
        status.textContent = hasFilters
          ? visible.length + (visible.length === 1 ? ' grid design found' : ' grid designs found')
          : 'All grid designs';
      }
    }

    form.addEventListener('change', function () { state.expanded = false; render(); });
    form.addEventListener('submit', function (e) { e.preventDefault(); });

    if (clearBtn) {
      clearBtn.addEventListener('click', function () {
        form.querySelectorAll('input[type="checkbox"]').forEach(function (i) { i.checked = false; });
        state.expanded = false;
        render();
      });
    }

    if (sortSelect) {
      sortSelect.addEventListener('change', function () { state.sort = sortSelect.value; render(); });
    }

    if (moreBtn) {
      moreBtn.addEventListener('click', function () { state.expanded = true; render(); });
    }

    render();
  }

  /* ---------- Filter group collapse ---------- */
  function initFilterToggles() {
    document.querySelectorAll('.filter-group__toggle').forEach(function (btn) {
      var options = btn.closest('.filter-group').querySelector('.filter-group__options');
      btn.addEventListener('click', function () {
        var open = btn.getAttribute('aria-expanded') === 'true';
        btn.setAttribute('aria-expanded', String(!open));
        options.hidden = open;
      });
    });
  }

  /* ---------- 6. Footer quick enquiry form ---------- */
  function initEnquiryForm() {
    var form = document.querySelector('[data-enquiry-form]');
    if (!form) return;
    var success = form.querySelector('[data-enquiry-success]');
    var EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

    var rules = {
      name: function (v) { return v.trim() ? '' : 'Please enter your name.'; },
      email: function (v) {
        if (!v.trim()) return 'Please enter your email address.';
        return EMAIL_RE.test(v.trim()) ? '' : 'Please enter a valid email address, e.g. name@example.com.';
      },
      message: function (v) { return v.trim().length >= 5 ? '' : 'Please tell us how we can help (at least 5 characters).'; }
    };

    function validateField(input) {
      var error = rules[input.name] ? rules[input.name](input.value) : '';
      var field = input.closest('.field');
      var holder = form.querySelector('[data-error-for="' + input.name + '"]');
      field.classList.toggle('is-invalid', !!error);
      input.setAttribute('aria-invalid', error ? 'true' : 'false');
      if (holder) {
        holder.textContent = error;
        holder.id = 'error-' + input.name;
        input.setAttribute('aria-describedby', holder.id);
      }
      return !error;
    }

    Array.prototype.forEach.call(form.elements, function (input) {
      if (!rules[input.name]) return;
      input.addEventListener('blur', function () { validateField(input); });
      input.addEventListener('input', function () {
        if (input.closest('.field').classList.contains('is-invalid')) validateField(input);
      });
    });

    form.addEventListener('submit', function (e) {
      e.preventDefault();
      var firstInvalid = null;
      Object.keys(rules).forEach(function (name) {
        var input = form.elements[name];
        if (!validateField(input) && !firstInvalid) firstInvalid = input;
      });
      if (firstInvalid) { firstInvalid.focus(); success.hidden = true; return; }

      // No backend yet: show success state and reset
      form.reset();
      success.hidden = false;
    });
  }
})();
