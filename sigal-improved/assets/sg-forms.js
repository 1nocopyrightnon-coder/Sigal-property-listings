// ═══════════════════════════════════════════════════════════════
// SIGAL GROUP REALTY — FORMS HANDLER
// Auto-wires form submissions to Netlify Forms (free, no API key)
// Works with the div-based "form-card" structures across all pages
// ═══════════════════════════════════════════════════════════════
(function(){
  'use strict';

  // Convert a label like "First Name" to a field name like "first_name"
  function nameFromLabel(label){
    return (label || '').trim().toLowerCase()
      .replace(/[^a-z0-9]+/g,'_')
      .replace(/^_+|_+$/g,'')
      .substring(0,40);
  }

  // Detect which form on this page → matches Netlify form-name stub in index.html
  function detectFormName(card){
    var title = (card.textContent || '').toLowerCase();
    if(title.indexOf('valuation') !== -1 || title.indexOf('home worth') !== -1 || title.indexOf("what's my home") !== -1) return 'home-valuation';
    return 'contact';
  }

  function wireCard(card){
    if(card.dataset.sgWired) return;
    card.dataset.sgWired = 'true';

    var formName = detectFormName(card);

    // Find all input fields and tag them with name attributes from their labels
    var fields = card.querySelectorAll('input, select, textarea');
    fields.forEach(function(field){
      if(field.name) return;
      var fgrp = field.closest('.fgrp, .field-group, .field, .form-row > div, .f2col > div');
      var lbl  = fgrp ? fgrp.querySelector('label') : null;
      var raw  = lbl ? lbl.textContent : (field.placeholder || field.type);
      field.name = nameFromLabel(raw) || ('field_' + Math.random().toString(36).slice(2,7));
    });

    // Find the submit button — looks like a "submit" / "send" button
    var submitBtn = card.querySelector(
      '.fsubmit, .cf-submit, .form-submit, .sb-submit, ' +
      'button[type="submit"], [class*="submit-btn"]'
    );
    // If no submit class, look for the last <button> or large styled element
    if(!submitBtn){
      var allBtns = card.querySelectorAll('button, [role="button"], a.btn');
      submitBtn = allBtns[allBtns.length - 1];
    }
    if(!submitBtn) return;

    // Wire up submit handler
    submitBtn.addEventListener('click', function(e){
      e.preventDefault();
      submitForm(card, submitBtn, formName);
    });
  }

  function submitForm(card, btn, formName){
    // Validate — at minimum need email or phone
    var emailField = card.querySelector('input[type="email"]');
    var phoneField = card.querySelector('input[type="tel"]');
    var nameField  = card.querySelector('input[name*="name"], input[name*="first"]');

    if(emailField && !emailField.value.trim() && phoneField && !phoneField.value.trim()){
      flashError(card, 'Please enter your email or phone so Sigal can reach you.');
      return;
    }
    if(emailField && emailField.value && !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(emailField.value.trim())){
      flashError(card, 'Please enter a valid email address.');
      emailField.focus();
      return;
    }

    // Collect form data
    var data = { 'form-name': formName };
    card.querySelectorAll('input, select, textarea').forEach(function(field){
      if(field.name && field.value) data[field.name] = field.value;
    });
    // Honeypot field for spam protection
    data['bot-field'] = '';

    // Disable button + show loading
    var originalText = btn.textContent;
    btn.disabled = true;
    btn.style.opacity = '0.7';
    btn.textContent = 'Sending…';

    // Encode and POST to Netlify Forms endpoint
    var body = Object.keys(data).map(function(k){
      return encodeURIComponent(k) + '=' + encodeURIComponent(data[k]);
    }).join('&');

    fetch('/', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: body
    })
    .then(function(r){
      if(!r.ok) throw new Error('HTTP ' + r.status);
      showSuccess(card, formName);
    })
    .catch(function(err){
      console.error('[Forms] Submission error:', err);
      btn.disabled = false;
      btn.style.opacity = '1';
      btn.textContent = originalText;
      flashError(card, 'Could not send right now. Please call Sigal directly at (617) 777-0485.');
    });
  }

  function flashError(card, msg){
    var existing = card.querySelector('.sg-form-error');
    if(existing) existing.remove();
    var err = document.createElement('div');
    err.className = 'sg-form-error';
    err.style.cssText = 'background:#FDEDEC;color:#C0392B;padding:14px 18px;border-radius:2px;font-size:.85rem;margin-bottom:1rem;border-left:3px solid #C0392B';
    err.textContent = '⚠ ' + msg;
    card.insertBefore(err, card.firstChild);
    setTimeout(function(){ if(err.parentNode) err.remove(); }, 6000);
  }

  function showSuccess(card, formName){
    var msg = formName === 'home-valuation'
      ? 'Sigal will review your property details and send your free valuation within 24 hours.'
      : 'Sigal will respond personally — usually within a few hours.';

    card.innerHTML =
      '<div style="padding:3.5rem 2rem;text-align:center">' +
        '<div style="width:72px;height:72px;border-radius:50%;background:#E8F5EE;display:inline-flex;align-items:center;justify-content:center;margin-bottom:1.5rem;font-size:2rem;color:#1A5C3A">✓</div>' +
        '<h3 style="font-family:\'Fraunces\',serif;font-size:1.8rem;color:#1A2820;margin-bottom:.6rem;font-weight:500">Thank You!</h3>' +
        '<p style="color:#4A6058;font-size:.95rem;line-height:1.6;max-width:380px;margin:0 auto 2rem">' + msg + '</p>' +
        '<div style="display:flex;gap:.8rem;justify-content:center;flex-wrap:wrap">' +
          '<a href="tel:6177770485" style="background:#1A5C3A;color:#fff;padding:.85rem 1.6rem;text-decoration:none;font-size:.75rem;letter-spacing:.1em;text-transform:uppercase;font-weight:600">📞 Call Now</a>' +
          '<a href="index.html" style="background:transparent;color:#1A5C3A;padding:.85rem 1.6rem;text-decoration:none;font-size:.75rem;letter-spacing:.1em;text-transform:uppercase;font-weight:600;border:1.5px solid #1A5C3A">← Back Home</a>' +
        '</div>' +
      '</div>';
  }

  function init(){
    // Find every form-card on the page and wire it up
    document.querySelectorAll('.form-card, .cf-form-card, .val-form, .valuation-card').forEach(wireCard);
  }

  if(document.readyState === 'loading'){
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
