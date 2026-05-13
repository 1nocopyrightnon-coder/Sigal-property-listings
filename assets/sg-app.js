// ═══════════════════════════════════════════════════════════════
// SIGAL GROUP REALTY — UNIFIED APP LOGIC
// Wires up: 3-tab hero search, address autocomplete, form submissions
// ═══════════════════════════════════════════════════════════════
(function(){
  'use strict';

  var ALL_CITIES = [];

  // Load city list from listings (for Buy tab autocomplete)
  fetch('listings/listings.json')
    .then(function(r){ return r.json(); })
    .then(function(data){
      var listings = data.listings || data || [];
      var citySet = {};
      listings.forEach(function(p){ if(p.city) citySet[p.city.trim()] = true; });
      ALL_CITIES = Object.keys(citySet).sort();
    })
    .catch(function(){ /* silent fail */ });

  // ──────────────────────────────────────────────────────
  // HERO SEARCH (3 tabs: Buy / Sell / Home Value)
  // ──────────────────────────────────────────────────────
  function initHeroSearch(){
    var card = document.querySelector('.hero-search-card, .hero-sc');
    if(!card) return;

    var tabs   = card.querySelectorAll('.hsc-tab, .hsc-btn-tab, [class*="hsc-tab"]');
    var input  = card.querySelector('input');
    var button = card.querySelector('button');
    if(!input || !button) return;

    // Detect active mode from tabs
    var mode = 'buy'; // buy | sell | value
    function setMode(newMode){
      mode = newMode;
      if(mode === 'buy'){
        input.placeholder = '🔍  City, neighborhood, or ZIP code';
        button.textContent = 'Search →';
      } else if(mode === 'sell'){
        input.placeholder = '🏡  Your home address';
        button.textContent = 'Get Selling Strategy →';
      } else if(mode === 'value'){
        input.placeholder = '📊  Your home address';
        button.textContent = "What's My Home Worth? →";
      }
      hideDropdown();
    }

    // Wire up the tab buttons
    tabs.forEach(function(tab){
      var label = (tab.textContent || '').toLowerCase();
      if(label.indexOf('buy') !== -1) tab.dataset.sgMode = 'buy';
      else if(label.indexOf('sell') !== -1) tab.dataset.sgMode = 'sell';
      else if(label.indexOf('value') !== -1 || label.indexOf('worth') !== -1) tab.dataset.sgMode = 'value';

      tab.addEventListener('click', function(e){
        e.preventDefault();
        tabs.forEach(function(t){ t.classList.remove('on','active','is-active'); });
        tab.classList.add('on');
        setMode(tab.dataset.sgMode || 'buy');
        input.focus();
      });
    });

    // ── Dropdown for suggestions ──
    var dropdown = document.createElement('div');
    dropdown.className = 'sg-search-dropdown';
    dropdown.style.cssText = 'display:none;position:absolute;top:calc(100% + 4px);left:0;right:0;background:#fff;border-radius:4px;box-shadow:0 12px 32px rgba(0,0,0,.16);max-height:340px;overflow-y:auto;z-index:1050;border:1px solid rgba(26,40,32,.08)';
    input.parentElement.style.position = 'relative';
    input.parentElement.appendChild(dropdown);

    function showDropdown(items){
      if(!items.length){
        dropdown.innerHTML = '<div style="padding:18px;color:#8FA89A;font-size:.85rem;font-style:italic;text-align:center">Keep typing to see suggestions…</div>';
      } else {
        dropdown.innerHTML = items.map(function(item){
          return '<div class="sg-dd-item" data-value="' + (item.value || item.label) + '" style="padding:14px 18px;cursor:pointer;font-size:.92rem;color:#1A2820;border-bottom:1px solid rgba(26,40,32,.06);display:flex;align-items:center;gap:12px;line-height:1.4;transition:background .15s"><span style="font-size:1rem;flex-shrink:0">' + (item.icon || '📍') + '</span><span style="flex:1">' + item.label + '</span></div>';
        }).join('');
        dropdown.querySelectorAll('.sg-dd-item').forEach(function(el){
          el.addEventListener('mouseenter', function(){ this.style.background = '#F8F3EA'; });
          el.addEventListener('mouseleave', function(){ this.style.background = '#fff'; });
          el.addEventListener('mousedown', function(e){ e.preventDefault(); });
          el.addEventListener('click', function(){
            input.value = this.dataset.value;
            hideDropdown();
            submit();
          });
        });
      }
      dropdown.style.display = 'block';
    }
    function hideDropdown(){ dropdown.style.display = 'none'; }

    // ── Input handler — different behavior per mode ──
    var debounceTimer;
    input.addEventListener('input', function(){
      var q = input.value.trim();
      clearTimeout(debounceTimer);

      if(mode === 'buy'){
        // Filter local city list
        if(!q){ hideDropdown(); return; }
        var matches = ALL_CITIES
          .filter(function(c){ return c.toLowerCase().indexOf(q.toLowerCase()) !== -1; })
          .slice(0, 8)
          .map(function(c){ return { label: c, value: c, icon: '📍' }; });
        showDropdown(matches);
      } else {
        // Address lookup via OpenStreetMap Nominatim (free, no key)
        if(q.length < 3){ hideDropdown(); return; }
        debounceTimer = setTimeout(function(){
          fetch('https://nominatim.openstreetmap.org/search?format=json&addressdetails=1&limit=6&countrycodes=us&q=' + encodeURIComponent(q + ', Florida'))
            .then(function(r){ return r.json(); })
            .then(function(results){
              var items = (results || []).map(function(r){
                var d = r.address || {};
                var label = r.display_name.split(',').slice(0, 4).join(',');
                return {
                  label: label,
                  value: r.display_name.split(',').slice(0, 4).join(',').trim(),
                  icon: '🏠'
                };
              });
              showDropdown(items);
            })
            .catch(function(){
              showDropdown([]);
            });
        }, 350);
      }
    });

    input.addEventListener('focus', function(){
      if(mode === 'buy' && !input.value && ALL_CITIES.length){
        showDropdown(ALL_CITIES.slice(0, 8).map(function(c){
          return { label: c, value: c, icon: '📍' };
        }));
      }
    });

    document.addEventListener('click', function(e){
      if(!card.contains(e.target)) hideDropdown();
    });

    // ── Submit ──
    function submit(){
      var q = input.value.trim();
      if(!q){ input.focus(); return; }
      if(mode === 'buy'){
        window.location.href = 'properties.html?city=' + encodeURIComponent(q);
      } else if(mode === 'sell'){
        window.location.href = 'sell.html?address=' + encodeURIComponent(q) + '&mode=sell';
      } else if(mode === 'value'){
        window.location.href = 'sell.html?address=' + encodeURIComponent(q) + '&mode=value#valuation';
      }
    }

    button.addEventListener('click', function(e){ e.preventDefault(); submit(); });
    input.addEventListener('keypress', function(e){ if(e.key === 'Enter'){ e.preventDefault(); submit(); } });

    // Set initial mode based on default active tab
    var activeTab = card.querySelector('.hsc-tab.on, .hsc-tab.active, .hsc-btn-tab.on');
    if(activeTab && activeTab.dataset.sgMode){
      setMode(activeTab.dataset.sgMode);
    }
  }

  // ──────────────────────────────────────────────────────
  // PRE-FILL VALUATION FORM (when arriving from hero search)
  // ──────────────────────────────────────────────────────
  function prefillFromURL(){
    var params = new URLSearchParams(window.location.search);
    var address = params.get('address');
    var mode = params.get('mode');
    if(!address) return;
    // Find any input that looks like an address field
    setTimeout(function(){
      var addressInput = document.querySelector(
        'input[placeholder*="address" i], input[placeholder*="property" i], input[name*="address" i]'
      );
      if(addressInput){
        addressInput.value = decodeURIComponent(address);
        addressInput.dispatchEvent(new Event('input',{bubbles:true}));
        // Scroll the form into view
        var card = addressInput.closest('.form-card, .val-form');
        if(card) setTimeout(function(){ card.scrollIntoView({behavior:'smooth',block:'center'}); }, 400);
      }
    }, 200);
  }

  // ──────────────────────────────────────────────────────
  // FORMS — auto-wire all form-card elements to Netlify Forms
  // ──────────────────────────────────────────────────────
  function nameFromLabel(label){
    return (label || '').trim().toLowerCase()
      .replace(/[^a-z0-9]+/g,'_').replace(/^_+|_+$/g,'').substring(0,40);
  }

  function detectFormName(card){
    var text = (card.textContent || '').toLowerCase();
    if(text.indexOf('valuation') !== -1 || text.indexOf('worth') !== -1 || text.indexOf('home value') !== -1) return 'home-valuation';
    return 'contact';
  }

  function wireFormCard(card){
    if(card.dataset.sgWired) return;
    card.dataset.sgWired = '1';

    var formName = detectFormName(card);

    // Assign name attributes to fields based on their labels
    card.querySelectorAll('input, select, textarea').forEach(function(field){
      if(field.name) return;
      var grp = field.closest('.fgrp, .field-group, .field, .form-row > div, .f2col > div');
      var lbl = grp ? grp.querySelector('label') : null;
      var raw = lbl ? lbl.textContent : (field.placeholder || field.type);
      field.name = nameFromLabel(raw) || ('field_' + Math.random().toString(36).slice(2,7));
    });

    // Find submit button
    var btn = card.querySelector('.fsubmit, .cf-submit, .form-submit, .sb-submit, button[type="submit"], [class*="submit"]');
    if(!btn){
      var allBtns = card.querySelectorAll('button, [role="button"]');
      btn = allBtns[allBtns.length - 1];
    }
    if(!btn) return;

    btn.addEventListener('click', function(e){
      e.preventDefault();
      submitForm(card, btn, formName);
    });
  }

  function submitForm(card, btn, formName){
    var email = card.querySelector('input[type="email"]');
    var phone = card.querySelector('input[type="tel"]');

    if((!email || !email.value.trim()) && (!phone || !phone.value.trim())){
      flashError(card, 'Please enter your email or phone so Sigal can reach you.');
      return;
    }
    if(email && email.value.trim() && !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email.value.trim())){
      flashError(card, 'Please enter a valid email address.');
      email.focus();
      return;
    }

    var data = { 'form-name': formName, 'bot-field': '' };
    card.querySelectorAll('input, select, textarea').forEach(function(field){
      if(field.name && field.value) data[field.name] = field.value;
    });
    // Add page context
    data['_source_page'] = window.location.pathname || '/';
    data['_submitted_at'] = new Date().toISOString();

    var originalText = btn.textContent;
    btn.disabled = true;
    btn.style.opacity = '0.7';
    btn.textContent = 'Sending…';

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
      btn.disabled = false;
      btn.style.opacity = '1';
      btn.textContent = originalText;
      flashError(card, 'Could not send — please call Sigal at (617) 777-0485.');
    });
  }

  function flashError(card, msg){
    var existing = card.querySelector('.sg-form-error');
    if(existing) existing.remove();
    var err = document.createElement('div');
    err.className = 'sg-form-error';
    err.style.cssText = 'background:#FDEDEC;color:#C0392B;padding:14px 18px;border-left:3px solid #C0392B;font-size:.88rem;margin-bottom:1rem;border-radius:2px';
    err.textContent = '⚠ ' + msg;
    card.insertBefore(err, card.firstChild);
    setTimeout(function(){ if(err.parentNode) err.remove(); }, 6000);
  }

  function showSuccess(card, formName){
    var msg = formName === 'home-valuation'
      ? 'Sigal will review your property and send your free valuation within 24 hours.'
      : 'Sigal will respond personally — usually within a few hours.';
    card.innerHTML =
      '<div style="padding:3.5rem 2rem;text-align:center">' +
        '<div style="width:72px;height:72px;border-radius:50%;background:#E8F5EE;display:inline-flex;align-items:center;justify-content:center;margin-bottom:1.5rem;font-size:2rem;color:#1A5C3A">✓</div>' +
        '<h3 style="font-family:Fraunces,serif;font-size:1.8rem;color:#1A2820;margin:0 0 .6rem;font-weight:500">Thank You!</h3>' +
        '<p style="color:#4A6058;font-size:.95rem;line-height:1.6;max-width:380px;margin:0 auto 2rem">' + msg + '</p>' +
        '<div style="display:flex;gap:.8rem;justify-content:center;flex-wrap:wrap">' +
          '<a href="tel:6177770485" style="background:#1A5C3A;color:#fff;padding:.85rem 1.6rem;text-decoration:none;font-size:.75rem;letter-spacing:.1em;text-transform:uppercase;font-weight:600;border-radius:2px">📞 Call Now</a>' +
          '<a href="index.html" style="background:transparent;color:#1A5C3A;padding:.85rem 1.6rem;text-decoration:none;font-size:.75rem;letter-spacing:.1em;text-transform:uppercase;font-weight:600;border:1.5px solid #1A5C3A;border-radius:2px">← Back Home</a>' +
        '</div>' +
      '</div>';
  }

  function initForms(){
    document.querySelectorAll('.form-card, .cf-form-card, .val-form, .valuation-card, [class*="form-card"]').forEach(wireFormCard);
  }

  // ──────────────────────────────────────────────────────
  // PROPERTIES PAGE — apply ?city= filter from URL
  // ──────────────────────────────────────────────────────
  function initPropertyFilter(){
    var params = new URLSearchParams(window.location.search);
    var cityFilter = params.get('city');
    if(!cityFilter) return;
    var attempts = 0;
    var interval = setInterval(function(){
      attempts++;
      if(attempts > 60){ clearInterval(interval); return; }
      var grid = document.getElementById('propsGrid');
      if(!grid) return;
      var cards = grid.querySelectorAll('.pcard');
      if(!cards.length) return;
      clearInterval(interval);

      var found = 0;
      cards.forEach(function(card){
        var loc = card.querySelector('.pcard-loc');
        var matches = loc && loc.textContent.toLowerCase().indexOf(cityFilter.toLowerCase()) !== -1;
        card.style.display = matches ? '' : 'none';
        if(matches) found++;
      });

      var countEl = document.getElementById('propCount');
      if(countEl) countEl.textContent = 'Showing ' + found + ' propert' + (found===1?'y':'ies') + ' in ' + cityFilter;

      if(!document.getElementById('cityFilterBadge')){
        var badge = document.createElement('div');
        badge.id = 'cityFilterBadge';
        badge.style.cssText = 'background:#1A5C3A;color:#fff;padding:14px 24px;display:flex;justify-content:space-between;align-items:center;margin-bottom:1.5rem;font-size:.85rem;letter-spacing:.04em;border-radius:2px;flex-wrap:wrap;gap:1rem';
        badge.innerHTML = '<span>📍 Filtered: <strong>' + cityFilter + '</strong> · ' + found + ' result' + (found===1?'':'s') + '</span><a href="properties.html" style="color:#F0DFA0;text-decoration:underline;font-size:.78rem;letter-spacing:.1em;text-transform:uppercase">✕ Clear filter</a>';
        grid.parentElement.insertBefore(badge, grid);
      }

      if(found === 0){
        grid.innerHTML = '<div style="grid-column:1/-1;text-align:center;padding:4rem 2rem;color:#8FA89A;background:#fff;border-radius:2px"><span style="font-size:3rem">🏠</span><div style="font-family:Fraunces,serif;font-size:1.4rem;color:#4A6058;margin:1rem 0 .6rem">No listings in ' + cityFilter + ' yet</div><div style="font-size:.9rem;margin-bottom:1.5rem">Sigal has access to off-market properties. Contact her for opportunities.</div><div style="display:flex;gap:.8rem;justify-content:center;flex-wrap:wrap"><a href="tel:6177770485" style="background:#1A5C3A;color:#fff;padding:.85rem 1.6rem;text-decoration:none;font-size:.75rem;letter-spacing:.1em;text-transform:uppercase;font-weight:600;border-radius:2px">📞 Call Sigal</a><a href="properties.html" style="background:transparent;color:#1A5C3A;padding:.85rem 1.6rem;text-decoration:none;font-size:.75rem;letter-spacing:.1em;text-transform:uppercase;font-weight:600;border:1.5px solid #1A5C3A;border-radius:2px">View All</a></div></div>';
      }
    }, 200);
  }

  // ──────────────────────────────────────────────────────
  // BOOT
  // ──────────────────────────────────────────────────────
  function boot(){
    initHeroSearch();
    prefillFromURL();
    initForms();
    initPropertyFilter();
  }

  if(document.readyState === 'loading'){
    document.addEventListener('DOMContentLoaded', boot);
  } else {
    boot();
  }
})();
