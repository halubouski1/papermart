/* =========================================================
   PaperMart — page scripts
   ========================================================= */
(function () {
  'use strict';

  document.addEventListener('DOMContentLoaded', function () {
    initInfoBar();
    initMobileMenu();
    initHeroSlider();
    initCart();
    initCatalog();
    initFilterToggles();
    initFiltersDrawer();
    initEnquiryForm();
    initContactForm();
    initOrderTracking();
    initAccordions();
    initProductPage();
    initProductTabs();
    initDropdowns();
    initReviews();
    initRelatedProductsSwiper();
    initBasketPage();
    initSmoothScroll();
    initAnimations();
  });

  var prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)');

  /* ---------- 0. Info bar: dismissible for the current browser session only ---------- */
  var INFO_BAR_KEY = 'pm-info-bar-closed';

  function initInfoBar() {
    var bar = document.querySelector('[data-info-bar]');
    if (!bar) return;
    var closed = false;
    try { localStorage.removeItem(INFO_BAR_KEY); } catch (e) { /* old permanent flag; storage unavailable */ }
    try { closed = sessionStorage.getItem(INFO_BAR_KEY) === '1'; } catch (e) { /* storage unavailable */ }
    if (closed) { bar.remove(); return; }

    bar.querySelector('[data-info-bar-close]').addEventListener('click', function () {
      try { sessionStorage.setItem(INFO_BAR_KEY, '1'); } catch (e) { /* storage unavailable */ }
      bar.style.height = bar.offsetHeight + 'px';
      bar.offsetHeight; // force reflow so the collapse animates
      bar.style.height = '0px';
      bar.addEventListener('transitionend', function () { bar.remove(); }, { once: true });
    });
  }

  /* ---------- Header menu (nav collapses ≤1279px) ---------- */
  function initMobileMenu() {
    var toggle = document.querySelector('[data-menu-toggle]');
    var nav = document.querySelector('[data-nav]');
    if (!toggle || !nav) return;
    var header = toggle.closest('.header');

    function setOpen(open) {
      header.classList.toggle('is-menu-open', open);
      toggle.setAttribute('aria-expanded', String(open));
      toggle.setAttribute('aria-label', open ? 'Close menu' : 'Open menu');
    }

    toggle.addEventListener('click', function () { setOpen(!header.classList.contains('is-menu-open')); });
    nav.addEventListener('click', function (e) { if (e.target.closest('a')) setOpen(false); });
    document.addEventListener('keydown', function (e) {
      if (e.key === 'Escape' && header.classList.contains('is-menu-open')) { setOpen(false); toggle.focus(); }
    });
    document.addEventListener('click', function (e) {
      if (header.classList.contains('is-menu-open') && !header.contains(e.target)) setOpen(false);
    });
    window.matchMedia('(min-width: 1280px)').addEventListener('change', function (e) { if (e.matches) setOpen(false); });
  }

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
  var cart = { count: 2, total: 89.90, currency: 'AUD', items: [] };

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

  /** Adds a configured line item and updates the header cart (no backend yet) */
  function addToCart(item) {
    cart.items.push(item);
    cart.count += item.quantity;
    cart.total = Math.round((cart.total + item.total) * 100) / 100;
    renderCart();
  }

  function initCart() {
    window.PaperMartCart = { update: updateCart, add: addToCart, get: function () { return Object.assign({}, cart); } };
    renderCart();
  }

  /* ---------- 3–5. Catalog: filtering, sorting, view more ---------- */
  var INITIAL_LIMIT = 8; // 8 products + the Custom Grid card = 9 cards (3 × 3), as in Figma
  var INITIAL_LIMIT_MOBILE = 4; // Figma "Home — mobile 360" shows 4 products before "View more"
  var catalogMobileMQ = window.matchMedia('(max-width: 768px)');

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
    var clearBtns = document.querySelectorAll('[data-filters-clear]');
    var resultsLabel = document.querySelector('[data-filters-results]');

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
      var limit = catalogMobileMQ.matches ? INITIAL_LIMIT_MOBILE : INITIAL_LIMIT;
      visible.forEach(function (p, i) { p.hidden = !state.expanded && i >= limit; });

      if (moreWrap) moreWrap.hidden = state.expanded || visible.length <= limit;
      if (empty) empty.hidden = visible.length > 0;
      if (status) {
        status.textContent = hasFilters
          ? visible.length + (visible.length === 1 ? ' grid design found' : ' grid designs found')
          : 'All grid designs';
      }
      // "Show N results" button at the bottom of the filters drawer
      if (resultsLabel) {
        resultsLabel.textContent = 'Show ' + visible.length + (visible.length === 1 ? ' result' : ' results');
      }
      refreshAnimations();
    }

    form.addEventListener('change', function () { state.expanded = false; render(); });
    form.addEventListener('submit', function (e) { e.preventDefault(); });

    Array.prototype.forEach.call(clearBtns, function (btn) {
      btn.addEventListener('click', function () {
        form.querySelectorAll('input[type="checkbox"]').forEach(function (i) { i.checked = false; });
        state.expanded = false;
        render();
      });
    });

    if (sortSelect) {
      sortSelect.addEventListener('change', function () { state.sort = sortSelect.dataset.value; render(); });
    }

    // "View more products": fade the new cards in one by one and glide down to the first of them
    function revealMore() {
      var shownBefore = products.filter(function (p) { return !p.hidden; });
      state.expanded = true;
      render();
      var newCards = products.filter(function (p) { return !p.hidden && shownBefore.indexOf(p) === -1; });
      if (!newCards.length || prefersReducedMotion.matches) return;

      newCards.forEach(function (card, i) {
        card.style.animationDelay = Math.min(i, 5) * 90 + 'ms';
        card.classList.remove('is-revealed');
        card.offsetWidth; // restart the animation
        card.classList.add('is-revealed');
      });

      // Layout position of the first new card (offsetTop ignores the reveal animation's translate)
      var headerH = parseFloat(getComputedStyle(document.documentElement).getPropertyValue('--header-h')) || 0;
      var top = 0;
      for (var el = newCards[0]; el; el = el.offsetParent) top += el.offsetTop;
      top -= headerH + 24;
      requestAnimationFrame(function () {
        if (window.PaperMartScroll) window.PaperMartScroll.scrollTo(top, { duration: 1.2 });
        else window.scrollTo({ top: top, behavior: 'smooth' });
      });
    }

    if (moreBtn) moreBtn.addEventListener('click', revealMore);

    catalogMobileMQ.addEventListener('change', render);

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

  /* ---------- 5b. Filters drawer (≤1279px the sidebar filters slide in from the left) ---------- */
  function initFiltersDrawer() {
    var openBtn = document.querySelector('[data-filters-open]');
    var panel = document.querySelector('[data-filters]');
    var backdrop = document.querySelector('[data-filters-backdrop]');
    if (!openBtn || !panel || !backdrop) return;
    var drawerMQ = window.matchMedia('(max-width: 1279px)');
    var closeBtns = panel.querySelectorAll('[data-filters-close]');

    function focusables() {
      return Array.prototype.filter.call(
        panel.querySelectorAll('button, input, [href], [tabindex]:not([tabindex="-1"])'),
        function (el) { return !el.disabled && el.offsetParent !== null; }
      );
    }

    function open() {
      panel.classList.add('is-open');
      backdrop.hidden = false;
      backdrop.offsetHeight; // reflow so the fade-in runs
      backdrop.classList.add('is-visible');
      document.documentElement.classList.add('is-drawer-open');
      openBtn.setAttribute('aria-expanded', 'true');
      panel.setAttribute('role', 'dialog');
      panel.setAttribute('aria-modal', 'true');
      document.addEventListener('keydown', onKeydown);
      var first = panel.querySelector('[data-filters-close]');
      if (first) first.focus();
    }

    function close(returnFocus) {
      if (!panel.classList.contains('is-open')) return;
      panel.classList.remove('is-open');
      backdrop.classList.remove('is-visible');
      document.documentElement.classList.remove('is-drawer-open');
      openBtn.setAttribute('aria-expanded', 'false');
      panel.removeAttribute('role');
      panel.removeAttribute('aria-modal');
      document.removeEventListener('keydown', onKeydown);
      setTimeout(function () { if (!panel.classList.contains('is-open')) backdrop.hidden = true; }, 300);
      if (returnFocus) openBtn.focus();
    }

    function onKeydown(e) {
      if (e.key === 'Escape') { close(true); return; }
      if (e.key !== 'Tab') return;
      // keep keyboard focus inside the open drawer
      var items = focusables();
      if (!items.length) return;
      var first = items[0];
      var last = items[items.length - 1];
      if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
      else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
    }

    openBtn.addEventListener('click', open);
    backdrop.addEventListener('click', function () { close(true); });
    Array.prototype.forEach.call(closeBtns, function (btn) {
      btn.addEventListener('click', function () { close(true); });
    });
    // Back to the desktop sidebar: drop the drawer state
    drawerMQ.addEventListener('change', function (e) { if (!e.matches) close(false); });
  }

  /* ---------- 6. Form validation (shared by footer enquiry + contact form) ---------- */
  var EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

  var validators = {
    name: function (v) { return v.trim() ? '' : 'Please enter your name.'; },
    email: function (v) {
      if (!v.trim()) return 'Please enter your email address.';
      return EMAIL_RE.test(v.trim()) ? '' : 'Please enter a valid email address, e.g. name@example.com.';
    },
    phone: function (v) {
      var digits = v.replace(/\D/g, '');
      if (!digits) return 'Please enter your phone number.';
      return /^[\d\s()+-]+$/.test(v.trim()) && digits.length >= 8 ? '' : 'Please enter a valid phone number, e.g. 0412 345 678.';
    },
    subject: function (v) { return v ? '' : 'Please select a subject.'; },
    message: function (v) { return v.trim().length >= 5 ? '' : 'Please tell us how we can help (at least 5 characters).'; },
    consent: function (checked) { return checked ? '' : 'Please agree to the Privacy Policy to send your message.'; }
  };

  /**
   * Wires live + on-submit validation for every field listed in `fields`.
   * Each field sits in a `.field` wrapper with a `[data-error-for="<name>"]` holder.
   * `onValid(form)` runs after a valid submit and should return a Promise.
   */
  function bindFormValidation(form, fields, success, onValid) {
    function valueOf(input) { return input.type === 'checkbox' ? input.checked : input.value; }

    function validateField(input) {
      var error = validators[input.name](valueOf(input));
      var field = input.closest('.field');
      var holder = form.querySelector('[data-error-for="' + input.name + '"]');
      field.classList.toggle('is-invalid', !!error);
      input.setAttribute('aria-invalid', error ? 'true' : 'false');
      if (holder) {
        holder.textContent = error;
        holder.id = 'error-' + input.id;
        input.setAttribute('aria-describedby', holder.id);
      }
      return !error;
    }

    fields.forEach(function (name) {
      var input = form.elements[name];
      if (!input) return;
      var revalidate = function () {
        if (input.closest('.field').classList.contains('is-invalid')) validateField(input);
      };
      if (input.type !== 'checkbox' && input.tagName !== 'SELECT') {
        input.addEventListener('blur', function () { validateField(input); });
      }
      input.addEventListener('input', revalidate);
      input.addEventListener('change', revalidate);
    });

    form.addEventListener('submit', function (e) {
      e.preventDefault();
      var firstInvalid = null;
      fields.forEach(function (name) {
        var input = form.elements[name];
        if (input && !validateField(input) && !firstInvalid) firstInvalid = input;
      });
      if (firstInvalid) { firstInvalid.focus(); success.hidden = true; return; }

      onValid(form).then(function () {
        form.reset();
        success.hidden = false;
      });
    });
  }

  /* No backend yet: resolve immediately. Replace with fetch() to the real endpoint later. */
  function sendForm(form) {
    var payload = Object.fromEntries(new FormData(form).entries());
    return Promise.resolve(payload);
  }

  function initEnquiryForm() {
    var form = document.querySelector('[data-enquiry-form]');
    if (!form) return;
    bindFormValidation(form, ['name', 'email', 'message'], form.querySelector('[data-enquiry-success]'), sendForm);
  }

  /* ---------- 7. Contact page: message form ---------- */
  function initContactForm() {
    var form = document.querySelector('[data-contact-form]');
    if (!form) return;
    bindFormValidation(
      form,
      ['name', 'email', 'phone', 'subject', 'message', 'consent'],
      form.querySelector('[data-contact-success]'),
      sendForm
    );

    // "Request a custom design" pre-selects the matching subject
    document.querySelectorAll('a[data-subject]').forEach(function (link) {
      link.addEventListener('click', function () {
        form.elements.subject.value = link.dataset.subject;
      });
    });
  }

  /* ---------- 8. Contact page: order tracking (placeholder until carrier API is connected) ---------- */
  function initOrderTracking() {
    var form = document.querySelector('[data-tracking-form]');
    var status = document.querySelector('[data-tracking-status]');
    if (!form || !status) return;
    var input = form.elements.tracking;

    function show(message, isError) {
      status.textContent = message;
      status.classList.toggle('is-error', isError);
      status.hidden = false;
    }

    form.addEventListener('submit', function (e) {
      e.preventDefault();
      var number = input.value.trim();
      if (!number) {
        input.setAttribute('aria-invalid', 'true');
        show('Please enter your order or tracking number.', true);
        input.focus();
        return;
      }
      input.setAttribute('aria-invalid', 'false');
      // TODO: replace with a request to the tracking API
      show('Thanks! Live tracking for ' + number + ' is coming soon. In the meantime, email us and we’ll check the status for you.', false);
    });
  }

  /* ---------- 9. FAQ accordions (one open item per group, smooth height animation) ---------- */
  function initAccordions() {
    document.querySelectorAll('[data-accordion]').forEach(function (accordion) {
      var items = Array.prototype.slice.call(accordion.querySelectorAll('.faq-item'));

      function setOpen(item, open) {
        var trigger = item.querySelector('.faq-item__trigger');
        var content = item.querySelector('.faq-item__content');
        if (item.classList.contains('is-open') === open) return;

        // Animate between a measured pixel height and 0; 'auto' is restored after opening
        content.style.height = (open ? 0 : content.scrollHeight) + 'px';
        content.offsetHeight; // force reflow so the start height is applied
        item.classList.toggle('is-open', open);
        trigger.setAttribute('aria-expanded', String(open));
        content.style.height = (open ? content.scrollHeight : 0) + 'px';
      }

      items.forEach(function (item) {
        var content = item.querySelector('.faq-item__content');
        content.addEventListener('transitionend', function (e) {
          if (e.propertyName === 'height' && item.classList.contains('is-open')) content.style.height = 'auto';
        });

        item.querySelector('.faq-item__trigger').addEventListener('click', function () {
          var willOpen = !item.classList.contains('is-open');
          if (willOpen) items.forEach(function (other) { if (other !== item) setOpen(other, false); });
          setOpen(item, willOpen);
        });
      });
    });
  }

  /* ---------- 10. Product page: gallery, options, pricing, basket ---------- */
  var QUANTITY_TIERS = [
    { key: '1', min: 1 },
    { key: '2', min: 2 },
    { key: '5', min: 5 },
    { key: '10', min: 10 }
  ];

  /*
   * Per-roll prices by tier [1, 2, 5, 10+], keyed by "width|paper|length".
   * Only the default configuration is priced in Figma. Add the real price list for the
   * other width / paper / length combinations here; until then they fall back to `default`.
   */
  var PRODUCT_PRICES = {
    '5mm-50mm-ruler': {
      'default': [49.95, 44.95, 42.45, 39.95],
      '610|90-white|10': [49.95, 44.95, 42.45, 39.95]
    }
  };

  var OPTION_LABELS = {
    width: { '610': '610mm (24")', '914': '914mm (36")' },
    paper: { '35-white': '35gsm White', '50-white': '50gsm White', '90-white': '90gsm White', '90-translucent': '90gsm Translucent', '120-white': '120gsm White' },
    length: { '10': '10 metres', '20': '20 metres' }
  };

  function money(value) { return '$' + value.toFixed(2); }

  function tierForQuantity(qty) {
    var match = QUANTITY_TIERS[0];
    QUANTITY_TIERS.forEach(function (t) { if (qty >= t.min) match = t; });
    return match.key;
  }

  function getTierPrices(state) {
    var table = PRODUCT_PRICES[state.productId] || {};
    return table[state.width + '|' + state.paper + '|' + state.length] || table['default'] || [0, 0, 0, 0];
  }

  function calculateProductPrice(state) {
    var prices = getTierPrices(state);
    var index = QUANTITY_TIERS.map(function (t) { return t.key; }).indexOf(state.tier);
    var unit = prices[index];
    return { tierPrices: prices, unit: unit, total: Math.round(unit * state.quantity * 100) / 100 };
  }

  function initProductPage() {
    var page = document.querySelector('[data-product-page]');
    if (!page) return;
    var form = page.querySelector('[data-product-form]');

    // Read radio groups by selector: form.elements.length would be the control count, not the "length" group
    function checkedValue(name) { return form.querySelector('input[name="' + name + '"]:checked').value; }

    var productState = {
      productId: page.dataset.productId,
      image: 0,
      width: checkedValue('width'),
      paper: checkedValue('paper'),
      length: checkedValue('length'),
      tier: '1',
      quantity: 1
    };

    initProductGallery(page, productState);

    var totalEl = page.querySelector('[data-product-total]');
    var tierButtons = Array.prototype.slice.call(page.querySelectorAll('[data-tier]'));
    var qtyInput = page.querySelector('[data-qty-input]');
    var minus = page.querySelector('[data-qty-minus]');
    var plus = page.querySelector('[data-qty-plus]');

    function renderProductPrice() {
      var price = calculateProductPrice(productState);
      totalEl.textContent = money(price.total);
      tierButtons.forEach(function (btn, i) {
        var active = btn.dataset.tier === productState.tier;
        btn.classList.toggle('is-selected', active);
        btn.setAttribute('aria-checked', String(active));
        btn.querySelector('[data-tier-price]').textContent = money(price.tierPrices[i]);
      });
      qtyInput.value = productState.quantity;
      minus.disabled = productState.quantity <= 1;
    }

    function setQuantity(qty, keepTier) {
      productState.quantity = Math.min(999, Math.max(1, parseInt(qty, 10) || 1));
      if (!keepTier) productState.tier = tierForQuantity(productState.quantity);
      renderProductPrice();
    }

    // Width / paper / length radios
    form.addEventListener('change', function (e) {
      if (['width', 'paper', 'length'].indexOf(e.target.name) === -1) return;
      productState[e.target.name] = e.target.value;
      renderProductPrice();
    });

    // Quantity tiers: selecting a tier sets the quantity to that tier's minimum
    tierButtons.forEach(function (btn) {
      btn.addEventListener('click', function () {
        var tier = QUANTITY_TIERS.filter(function (t) { return t.key === btn.dataset.tier; })[0];
        productState.tier = tier.key;
        setQuantity(tier.min, true);
      });
    });

    // Quantity selector
    minus.addEventListener('click', function () { setQuantity(productState.quantity - 1); });
    plus.addEventListener('click', function () { setQuantity(productState.quantity + 1); });
    qtyInput.addEventListener('change', function () { setQuantity(qtyInput.value); });

    // Add to basket → existing header cart
    var addBtn = page.querySelector('[data-add-to-basket]');
    var addLabel = addBtn.querySelector('[data-add-label]');
    var status = page.querySelector('[data-basket-status]');
    var resetTimer;
    form.addEventListener('submit', function (e) {
      e.preventDefault();
      var price = calculateProductPrice(productState);
      var item = {
        productId: productState.productId,
        width: productState.width,
        paper: productState.paper,
        length: productState.length,
        tier: productState.tier,
        quantity: productState.quantity,
        unitPrice: price.unit,
        total: price.total
      };
      if (window.PaperMartCart) window.PaperMartCart.add(item);

      status.textContent = 'Added ' + item.quantity + ' × ' + OPTION_LABELS.width[item.width] + ', ' +
        OPTION_LABELS.paper[item.paper] + ', ' + OPTION_LABELS.length[item.length] + ' to your basket (' + money(item.total) + ' AUD).';
      addBtn.classList.add('is-added');
      addLabel.textContent = 'Added to Basket';
      clearTimeout(resetTimer);
      resetTimer = setTimeout(function () {
        addBtn.classList.remove('is-added');
        addLabel.textContent = 'Add to Basket';
      }, 2000);
    });

    renderProductPrice();
  }

  function initProductGallery(page, productState) {
    var image = page.querySelector('[data-gallery-image]');
    var thumbs = Array.prototype.slice.call(page.querySelectorAll('[data-gallery-thumb]'));
    if (!image || !thumbs.length) return;
    var pending = 0;

    function show(index) {
      if (index === productState.image) return;
      productState.image = index;
      var thumb = thumbs[index];
      var token = ++pending;

      thumbs.forEach(function (t, i) {
        t.classList.toggle('is-active', i === index);
        t.setAttribute('aria-pressed', String(i === index));
      });

      image.classList.add('is-fading');
      setTimeout(function () {
        if (token !== pending) return; // a newer thumbnail was chosen meanwhile
        image.src = thumb.dataset.src;
        image.alt = thumb.dataset.alt;
        var done = function () { if (token === pending) image.classList.remove('is-fading'); };
        if (image.decode) image.decode().then(done, done); else done();
      }, 200);
    }

    thumbs.forEach(function (thumb, i) {
      thumb.addEventListener('mouseenter', function () { show(i); });
      thumb.addEventListener('click', function () { show(i); });
    });
  }

  /* ---------- 11. Product detail tabs ---------- */
  function initProductTabs() {
    var root = document.querySelector('[data-tabs]');
    if (!root) return;
    var tabs = Array.prototype.slice.call(root.querySelectorAll('[role="tab"]'));

    function activate(tab, focus) {
      tabs.forEach(function (t) {
        var selected = t === tab;
        t.setAttribute('aria-selected', String(selected));
        t.tabIndex = selected ? 0 : -1;
        document.getElementById(t.getAttribute('aria-controls')).hidden = !selected;
      });
      if (focus) tab.focus();
      // On narrow screens the tab row scrolls sideways: bring the active tab fully into view
      var nav = tab.parentElement;
      if (nav.scrollWidth > nav.clientWidth) {
        var tabLeft = tab.getBoundingClientRect().left - nav.getBoundingClientRect().left + nav.scrollLeft;
        nav.scrollTo({ left: Math.max(0, tabLeft - (nav.clientWidth - tab.offsetWidth) / 2), behavior: 'smooth' });
      }
      updateScrollFade();
      refreshAnimations();
    }

    tabs.forEach(function (tab, i) {
      tab.addEventListener('click', function () { activate(tab); });
      tab.addEventListener('keydown', function (e) {
        var next = { ArrowRight: i + 1, ArrowLeft: i - 1, Home: 0, End: tabs.length - 1 }[e.key];
        if (next === undefined) return;
        e.preventDefault();
        activate(tabs[(next + tabs.length) % tabs.length], true);
      });
    });

    // "· 7 reviews" link next to the rating opens the Reviews tab
    document.querySelectorAll('[data-open-tab]').forEach(function (link) {
      link.addEventListener('click', function () {
        var tab = root.querySelector('[data-tab="' + link.dataset.openTab + '"]');
        if (tab) activate(tab);
      });
    });

    // Fade at the bottom of the scrollable description hides once the end is reached
    var fadeBox = root.querySelector('[data-scroll-fade]');
    var scroller = fadeBox && fadeBox.firstElementChild;
    function updateScrollFade() {
      if (!scroller) return;
      fadeBox.classList.toggle('is-scrolled-end', scroller.scrollTop + scroller.clientHeight >= scroller.scrollHeight - 2);
    }
    if (scroller) scroller.addEventListener('scroll', updateScrollFade, { passive: true });
    updateScrollFade();
  }

  /* ---------- 11b. Dropdown (custom listbox, e.g. review sort) ----------
     Root [data-dropdown] keeps the chosen value in data-value and fires
     a "change" event on it, so callers listen like they would on a select. */
  function initDropdowns() {
    document.querySelectorAll('[data-dropdown]').forEach(function (root) {
      var toggle = root.querySelector('[data-dropdown-toggle]');
      var menu = root.querySelector('[data-dropdown-menu]');
      var label = root.querySelector('[data-dropdown-label]');
      var options = Array.prototype.slice.call(menu.querySelectorAll('[role="option"]'));

      function selectedIndex() {
        for (var i = 0; i < options.length; i++) if (options[i].getAttribute('aria-selected') === 'true') return i;
        return 0;
      }

      function open() {
        if (!menu.hidden) return;
        menu.hidden = false;
        toggle.setAttribute('aria-expanded', 'true');
        options[selectedIndex()].focus();
        document.addEventListener('pointerdown', onOutside);
      }

      function close(returnFocus) {
        if (menu.hidden) return;
        menu.hidden = true;
        toggle.setAttribute('aria-expanded', 'false');
        document.removeEventListener('pointerdown', onOutside);
        if (returnFocus) toggle.focus();
      }

      function onOutside(e) {
        if (!root.contains(e.target)) close(false);
      }

      function choose(option) {
        var changed = option.dataset.value !== root.dataset.value;
        options.forEach(function (o) { o.setAttribute('aria-selected', String(o === option)); });
        label.textContent = option.textContent;
        root.dataset.value = option.dataset.value;
        close(true);
        if (changed) root.dispatchEvent(new Event('change'));
      }

      toggle.addEventListener('click', function () {
        if (menu.hidden) open(); else close(true);
      });
      toggle.addEventListener('keydown', function (e) {
        if (e.key === 'ArrowDown' || e.key === 'ArrowUp') { e.preventDefault(); open(); }
      });

      options.forEach(function (option, i) {
        option.addEventListener('click', function () { choose(option); });
        option.addEventListener('keydown', function (e) {
          var next = { ArrowDown: i + 1, ArrowUp: i - 1, Home: 0, End: options.length - 1 }[e.key];
          if (next !== undefined) {
            e.preventDefault();
            options[Math.min(Math.max(next, 0), options.length - 1)].focus();
          } else if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault();
            choose(option);
          } else if (e.key === 'Escape') {
            e.preventDefault();
            close(true);
          } else if (e.key === 'Tab') {
            close(false);
          }
        });
      });
    });
  }

  /* ---------- 12. Reviews: sorting, show more, write a review ---------- */
  var REVIEWS_INITIAL = 3;

  function initReviews() {
    var root = document.querySelector('[data-reviews]');
    if (!root) return;
    var list = root.querySelector('[data-review-items]');
    var reviews = Array.prototype.slice.call(list.querySelectorAll('[data-review]'));
    var sortSelect = root.querySelector('[data-review-sort]');
    var toggle = root.querySelector('[data-review-toggle]');
    var toggleLabel = root.querySelector('[data-review-toggle-label]');
    var count = root.querySelector('[data-review-count]');
    var state = { sort: 'recent', expanded: false };

    var sorters = {
      recent: function (a, b) { return b.dataset.date.localeCompare(a.dataset.date); },
      highest: function (a, b) { return b.dataset.rating - a.dataset.rating || sorters.recent(a, b); },
      lowest: function (a, b) { return a.dataset.rating - b.dataset.rating || sorters.recent(a, b); }
    };

    function render(reveal) {
      reviews.sort(sorters[state.sort]).forEach(function (r) { list.appendChild(r); });
      var visible = state.expanded ? reviews.length : Math.min(REVIEWS_INITIAL, reviews.length);
      reviews.forEach(function (r, i) {
        var wasHidden = r.hidden;
        r.hidden = i >= visible;
        r.classList.toggle('is-revealed', reveal && wasHidden && !r.hidden);
      });
      count.textContent = 'Showing ' + visible + ' of ' + reviews.length + ' reviews';
      toggle.parentElement.hidden = reviews.length <= REVIEWS_INITIAL;
      toggle.setAttribute('aria-expanded', String(state.expanded));
      toggleLabel.textContent = state.expanded ? 'Show fewer reviews' : 'Show more reviews';
      refreshAnimations();
    }

    sortSelect.addEventListener('change', function () { state.sort = sortSelect.dataset.value; render(false); });
    toggle.addEventListener('click', function () { state.expanded = !state.expanded; render(state.expanded); });
    render(false);

    initReviewDialog(root);
  }

  function initReviewDialog(root) {
    var openBtn = root.querySelector('[data-review-open]');
    var dialog = document.querySelector('[data-review-dialog]');
    if (!openBtn || !dialog || typeof dialog.showModal !== 'function') return;
    var form = dialog.querySelector('[data-review-form]');
    var success = dialog.querySelector('[data-review-success]');

    var checks = {
      rating: function () { return form.querySelector('input[name="rating"]:checked') ? '' : 'Please choose a star rating.'; },
      name: function () { return form.elements.name.value.trim() ? '' : 'Please enter your name.'; },
      title: function () { return form.elements.title.value.trim() ? '' : 'Please add a short title.'; },
      review: function () { return form.elements.review.value.trim().length >= 10 ? '' : 'Please write at least 10 characters.'; }
    };

    function validate() {
      var first = null;
      Object.keys(checks).forEach(function (key) {
        var error = checks[key]();
        var holder = form.querySelector('[data-error-for="' + key + '"]');
        holder.textContent = error;
        holder.closest('.field').classList.toggle('is-invalid', !!error);
        if (error && !first) first = key === 'rating' ? form.querySelector('input[name="rating"]') : form.elements[key];
      });
      if (first) first.focus();
      return !first;
    }

    openBtn.addEventListener('click', function () { success.hidden = true; dialog.showModal(); });
    dialog.querySelector('[data-review-close]').addEventListener('click', function () { dialog.close(); });
    dialog.addEventListener('click', function (e) { if (e.target === dialog) dialog.close(); });
    form.addEventListener('submit', function (e) {
      e.preventDefault();
      if (!validate()) return;
      // No backend yet: the review is not stored or published
      form.reset();
      success.hidden = false;
    });
  }

  /* ---------- 16. Basket page: quantities, totals, clear, discount ---------- */
  function initBasketPage() {
    var root = document.querySelector('[data-basket]');
    if (!root) return;
    var list = root.querySelector('[data-basket-list]');
    var empty = root.querySelector('[data-basket-empty]');
    var clearBtn = root.querySelector('[data-basket-clear]');
    var checkout = root.querySelector('[data-checkout]');
    var countLabel = document.querySelector('[data-basket-count-label]');
    var itemsLabel = root.querySelector('[data-basket-items-label]');
    var subtotalLabel = root.querySelector('[data-basket-subtotal-label]');
    var subtotal = root.querySelector('[data-basket-subtotal]');
    var total = root.querySelector('[data-basket-total]');

    function items() { return Array.prototype.slice.call(list.querySelectorAll('[data-basket-item]')); }
    function plural(n) { return n + (n === 1 ? ' item' : ' items'); }

    function update() {
      var count = 0;
      var sum = 0;
      items().forEach(function (item) {
        var input = item.querySelector('[data-basket-qty]');
        var qty = Math.min(99, Math.max(1, parseInt(input.value, 10) || 1));
        input.value = qty;
        // At 1 the minus button removes the item instead of being disabled
        var minus = item.querySelector('[data-basket-minus]');
        var name = item.querySelector('.basket-item__title').textContent.trim();
        minus.setAttribute('aria-label', qty <= 1 ? 'Remove ' + name + ' from basket' : 'Decrease quantity');
        var line = Math.round(parseFloat(item.dataset.price) * qty * 100) / 100;
        item.querySelector('[data-basket-line-total]').textContent = formatPrice(line, 'AUD');
        count += qty;
        sum += line;
      });
      sum = Math.round(sum * 100) / 100;
      countLabel.textContent = plural(count);
      itemsLabel.textContent = plural(count) + ' in your basket';
      subtotalLabel.textContent = 'Subtotal (' + plural(count) + ')';
      subtotal.textContent = formatPrice(sum, 'AUD');
      total.textContent = '$' + sum.toFixed(2);
      var isEmpty = count === 0;
      empty.hidden = !isEmpty;
      clearBtn.hidden = isEmpty;
      checkout.classList.toggle('is-disabled', isEmpty);
      checkout.setAttribute('aria-disabled', String(isEmpty));
      updateCart({ count: count, total: sum });
    }

    // Fade items out, then drop them and recalculate
    function removeItems(toRemove) {
      toRemove.forEach(function (item) { item.classList.add('is-removing'); });
      setTimeout(function () {
        toRemove.forEach(function (item) { item.remove(); });
        update();
        refreshAnimations();
      }, prefersReducedMotion.matches ? 0 : 300);
    }

    list.addEventListener('click', function (e) {
      var btn = e.target.closest('[data-basket-minus], [data-basket-plus]');
      if (!btn) return;
      var item = btn.closest('[data-basket-item]');
      if (item.classList.contains('is-removing')) return;
      var input = item.querySelector('[data-basket-qty]');
      var qty = (parseInt(input.value, 10) || 1) + (btn.hasAttribute('data-basket-plus') ? 1 : -1);
      if (qty < 1) { removeItems([item]); return; }
      input.value = qty;
      update();
    });
    list.addEventListener('change', function (e) {
      if (!e.target.matches('[data-basket-qty]')) return;
      // Typing 0 removes the item too
      if (parseInt(e.target.value, 10) === 0) removeItems([e.target.closest('[data-basket-item]')]);
      else update();
    });

    clearBtn.addEventListener('click', function () { removeItems(items()); });

    // No discount backend yet: validate the field and say so honestly
    var discount = root.querySelector('[data-discount-form]');
    var discountMsg = root.querySelector('[data-discount-message]');
    discount.addEventListener('submit', function (e) {
      e.preventDefault();
      var code = discount.elements.code.value.trim();
      discountMsg.textContent = code ? 'Sorry, “' + code + '” isn’t a valid discount code.' : 'Please enter a discount code.';
    });

    update();
  }

  /* ---------- 14. Smooth scrolling (Lenis) ---------- */
  function initSmoothScroll() {
    if (typeof Lenis === 'undefined' || prefersReducedMotion.matches) return;

    var lenis = new Lenis({
      lerp: 0.1,
      // Hand the wheel to the browser only inside boxes that really scroll on their own right now
      // (the desktop filters sidebar and header nav are not scroll boxes, so the page keeps gliding there)
      prevent: function (node) {
        return node.matches('.filters.is-open, .header.is-menu-open .nav, dialog[open]') ||
          (node.classList.contains('product-description__scroll') && node.scrollHeight > node.clientHeight + 1);
      }
    });
    window.PaperMartScroll = lenis;
    function raf(time) { lenis.raf(time); requestAnimationFrame(raf); }
    requestAnimationFrame(raf);

    // In-page links (#catalog, #paper-weights…) glide to their target below the sticky header
    document.addEventListener('click', function (e) {
      var link = e.target.closest('a[href^="#"]');
      if (!link || e.defaultPrevented) return;
      var id = link.getAttribute('href');
      if (id.length < 2) return;
      var target = document.querySelector(id);
      if (!target) return;
      e.preventDefault();
      var headerH = parseFloat(getComputedStyle(document.documentElement).getPropertyValue('--header-h')) || 0;
      lenis.scrollTo(target, { offset: -headerH });
    });

    // Freeze the page while the filters drawer is open
    new MutationObserver(function () {
      if (document.documentElement.classList.contains('is-drawer-open')) lenis.stop(); else lenis.start();
    }).observe(document.documentElement, { attributes: true, attributeFilter: ['class'] });
  }

  /* ---------- 15. Scroll-in animations (AOS) ----------
     Attributes are set here, so the HTML stays clean. `stagger` delays
     siblings one after another (in steps of 80ms, max 3 per row). */
  var ANIMATIONS = [
    { selector: '.page-hero__content', aos: 'fade-up' },
    { selector: '.section-title', aos: 'fade-up' },
    { selector: '.trust-item', aos: 'fade-up', stagger: true },
    { selector: '.catalog__toolbar', aos: 'fade-up' },
    { selector: '.product-grid > .product-card', aos: 'fade-up', stagger: true },
    { selector: '.sidebar-card', aos: 'fade-up' },
    { selector: '.paper-weight-card', aos: 'fade-up', stagger: true },
    { selector: '.spec-card', aos: 'fade-up', stagger: true },
    { selector: '.info-note', aos: 'fade-up' },
    { selector: '.paper-contact-cta__panel', aos: 'zoom-in-up' },
    { selector: '.delivery-plan', aos: 'fade-up', stagger: true },
    { selector: '.order-tracking', aos: 'fade-up' },
    { selector: '.support-card', aos: 'fade-up', stagger: true },
    { selector: '.delivery-trust__item', aos: 'fade-up', stagger: true },
    { selector: '.faq-section', aos: 'fade-up' },
    { selector: '.faq-support', aos: 'fade-up' },
    { selector: '.contact-method', aos: 'fade-up', stagger: true },
    { selector: '.contact-form', aos: 'fade-up' },
    { selector: '.location-card', aos: 'fade-up', stagger: true },
    { selector: '.custom-grid-cta__panel', aos: 'zoom-in-up' },
    { selector: '.product-gallery', aos: 'fade-right' },
    { selector: '.product-info', aos: 'fade-left' },
    { selector: '.tabs-card', aos: 'fade-up' },
    { selector: '.related__carousel', aos: 'fade-up' },
    { selector: '.policy-hero__banner', aos: 'fade-up' },
    { selector: '.policy__card', aos: 'fade-up' },
    { selector: '.basket-items', aos: 'fade-up' },
    { selector: '.order-summary', aos: 'fade-up', stagger: true },
    { selector: '.footer__top > *', aos: 'fade-up', stagger: true }
  ];

  function initAnimations() {
    if (typeof AOS === 'undefined') return;
    ANIMATIONS.forEach(function (rule) {
      document.querySelectorAll(rule.selector).forEach(function (el, i) {
        el.setAttribute('data-aos', rule.aos);
        if (rule.stagger && i % 3) el.setAttribute('data-aos-delay', String((i % 3) * 80));
      });
    });
    AOS.init({
      duration: 700,
      easing: 'ease-out-cubic',
      offset: 60,
      once: true,
      disable: function () { return prefersReducedMotion.matches; }
    });
  }

  // Recalculate positions after content is shown, hidden or reordered
  function refreshAnimations() {
    if (typeof AOS === 'undefined' || !document.querySelector('.aos-init')) return;
    AOS.refresh();
    window.dispatchEvent(new Event('scroll'));
  }

  /* ---------- 13. You may also like (Swiper) ---------- */
  function initRelatedProductsSwiper() {
    var el = document.querySelector('[data-related-slider]');
    if (!el || typeof Swiper === 'undefined') return;

    new Swiper(el, {
      slidesPerView: 1,
      spaceBetween: 16,
      speed: 600,
      watchOverflow: true,
      navigation: { prevEl: '[data-related-prev]', nextEl: '[data-related-next]' },
      breakpoints: {
        769: { slidesPerView: 2, spaceBetween: 24 },
        1280: { slidesPerView: 4, spaceBetween: 18 },
        1920: { slidesPerView: 4, spaceBetween: 24 }
      },
      a11y: { prevSlideMessage: 'Previous products', nextSlideMessage: 'Next products' }
    });
  }
})();
