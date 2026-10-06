(function () {
  'use strict';
  var config = window.TPJ_WEB || {};
  if (!config.ajaxUrl || !config.nonce) return;

  function send(event, fields) {
    var data = new URLSearchParams({ action: 'tpj_web_event', nonce: config.nonce, event: event });
    Object.keys(fields || {}).forEach(function (key) { data.set(key, String(fields[key])); });
    return fetch(config.ajaxUrl, {
      method: 'POST', credentials: 'same-origin',
      keepalive: true,
      headers: { 'Content-Type': 'application/x-www-form-urlencoded; charset=UTF-8' },
      body: data.toString()
    }).then(function (response) { return response.json(); }).then(function (result) {
      if (!result.success) throw new Error(result.data && result.data.message || 'Could not save WhatsApp preference.');
      return result;
    });
  }

  function checkbox() {
    var label = document.createElement('label');
    label.className = 'tpj-optin';
    var input = document.createElement('input');
    input.type = 'checkbox';
    input.className = 'tpj-optin__input';
    var copy = document.createElement('span');
    copy.textContent = 'Optional: Send me trip suggestions and follow-ups on WhatsApp. I can opt out anytime.';
    label.appendChild(input);
    label.appendChild(copy);
    return { label: label, input: input };
  }

  function pdf(rootSelector, emailSelector, phoneSelector, buttonSelector, tourId) {
    var root = document.querySelector(rootSelector);
    if (!root || root.dataset.tpjReady) return;
    var email = root.querySelector(emailSelector);
    var phone = root.querySelector(phoneSelector);
    var button = root.querySelector(buttonSelector);
    if (!email || !phone || !button) return;
    root.dataset.tpjReady = '1';
    var choice = checkbox();
    phone.insertAdjacentElement('afterend', choice.label);
    button.addEventListener('click', function () {
      if (!choice.input.checked || !email.checkValidity() || !email.value.trim() || phone.value.replace(/\D/g, '').length < 10) return;
      var id = tourId || 0;
      if (!id && window.jQuery) id = Number(window.jQuery(button).data('postid')) || 0;
      send('consent', { consent: 1, source: 'itinerary', phone: phone.value.trim(), email: email.value.trim(), tour_id: id })
        .then(function () { return send('itinerary_downloaded', { tour_id: id }); })
        .catch(function () {}); // The requested PDF must never depend on marketing delivery.
    }, true);
  }

  function checkout() {
    var root = document.querySelector('.tp-own-checkout');
    if (!root || root.dataset.tpjReady) return;
    var phone = root.querySelector('[name="st_phone"]');
    var email = root.querySelector('[name="st_email"]');
    var target = root.querySelector('.tp-own-consents');
    if (!phone || !email || !target) return;
    root.dataset.tpjReady = '1';
    var choice = checkbox();
    target.appendChild(choice.label);
    var status = document.createElement('small');
    status.className = 'tpj-optin__status';
    status.setAttribute('role', 'status');
    target.appendChild(status);
    var timer;
    var generation = 0;
    var optedHere = false;
    function schedule() {
      window.clearTimeout(timer);
      var current = ++generation;
      if (!choice.input.checked) {
        status.textContent = '';
        if (optedHere) send('withdraw').catch(function () {});
        optedHere = false;
        return;
      }
      optedHere = true;
      if (phone.value.replace(/\D/g, '').length < 10) return;
      timer = window.setTimeout(function () {
        send('consent', { consent: 1, source: 'checkout', phone: phone.value.trim(), email: email.value.trim(), tour_id: config.cartTourId || 0 })
          .then(function () {
            if (current !== generation || !choice.input.checked) return send('withdraw');
            return send('checkout_started', { tour_id: config.cartTourId || 0 });
          })
          .then(function () { if (current === generation && choice.input.checked) status.textContent = 'WhatsApp follow-up preference saved.'; })
          .catch(function () { if (current === generation) status.textContent = 'WhatsApp reminders could not be enabled right now.'; });
      }, 900);
    }
    choice.input.addEventListener('change', schedule);
    phone.addEventListener('input', schedule);
    email.addEventListener('change', schedule);
  }

  function registration() {
    document.querySelectorAll('form').forEach(function (form) {
      if (form.dataset.tpjRegister) return;
      var identity = [form.id, form.className, form.getAttribute('action') || ''].join(' ');
      if (!/register|sign.?up/i.test(identity)) return;
      var phone = form.querySelector('[name="st_phone"], [name="phone"], input[type="tel"]');
      if (!phone || form.querySelector('[name="tpj_followups"]')) return;
      form.dataset.tpjRegister = '1';
      var choice = checkbox();
      choice.input.name = 'tpj_followups';
      choice.input.value = '1';
      phone.closest('label')?.insertAdjacentElement('afterend', choice.label) || phone.insertAdjacentElement('afterend', choice.label);
    });
  }

  var otpBound = false;
  function otpSignup() {
    if (otpBound || !window.jQuery) return;
    var identity = document.getElementById('tripanza-email');
    var form = identity && identity.closest('form');
    if (!form) return;
    otpBound = true;
    var existing = form.querySelector('[name="tpj_followups"]');
    var choice = existing ? { input: existing, label: existing.closest('.tpj-optin') } : checkbox();
    if (!existing) {
      choice.input.name = 'tpj_followups';
      choice.input.value = '1';
      var anchor = identity.closest('.tripanza-input-wrap') || identity;
      anchor.insertAdjacentElement('afterend', choice.label);
    }
    if (!choice.label) return;
    function visible() { choice.label.hidden = form.dataset.authChannel !== 'whatsapp'; }
    visible();
    var channelObserver = new MutationObserver(visible);
    channelObserver.observe(form, { attributes: true, attributeFilter: ['data-auth-channel'] });
    window.jQuery(document).ajaxSuccess(function (_event, _xhr, settings, result) {
      if (!choice.input.checked || !result || !result.success || !settings || !settings.data) return;
      var params = new URLSearchParams(String(settings.data));
      if (params.get('action') !== 'sol_verify_otp' || params.get('channel') !== 'whatsapp') return;
      var phone = params.get('email') || '';
      if (phone.replace(/\D/g, '').length < 10) return;
      send('consent', { consent: 1, source: 'signup', phone: phone }).catch(function () {});
    });
  }

  function mount() {
    pdf('#downloadModal', '#itinerary_email', '#itinerary_phone', '#submitItineraryForm', Number(config.tourId) || 0);
    pdf('#tzDownloadModal', '#tz_itinerary_email', '#tz_itinerary_phone', '#tz_submitItineraryForm', 0);
    checkout();
    otpSignup();
    registration();
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', mount);
  else mount();
  // Traveler may inject its login/checkout markup after the initial page load.
  var observer = new MutationObserver(function () { mount(); });
  observer.observe(document.documentElement, { childList: true, subtree: true });
  window.setTimeout(function () { observer.disconnect(); }, 30000);
  if (Number(config.tourId) > 0) send('tour_view', { tour_id: config.tourId }).catch(function () {});
  if (Number(config.cartTourId) > 0 && /\/cart\/?$/i.test(location.pathname)) send('cart_created', { tour_id: config.cartTourId }).catch(function () {});
}());
