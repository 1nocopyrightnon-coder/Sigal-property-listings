// ═══════════════════════════════════════════════════════════════
// SIGAL GROUP REALTY — UNIFIED APP LOGIC v2
// • 3-tab hero search (Buy / Sell / Home Value)
// • Real-time address autocomplete via Photon (open-source OSM)
// • Form auto-wiring to Netlify Forms
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
    .catch(function(){});

  // ──────────────────────────────────────────────────────
  // PHOTON ADDRESS AUTOCOMPLETE
  // https://photon.komoot.io — free, no key, no signup
  // Built on OpenStreetMap data, optimized for typeahead
  // ──────────────────────────────────────────────────────
  // Florida bounding box approx for biasing results
  var FL_BIAS_LAT = 27.7663;
  var FL_BIAS_LON = -81.6868;

  function searchAddresses(query, callback){
    if(!query || query.length < 2){ callback([]); return; }
    var url = 'https://photon.komoot.io/api/'
      + '?q=' + encodeURIComponent(query)
      + '&limit=6'
      + '&lat=' + FL_BIAS_LAT + '&lon=' + FL_BIAS_LON
      + '&osm_tag=:!railway'  // exclude railway results
      + '&lang=en';
    fetch(url)
      .then(function(r){ return r.json(); })
      .then(function(data){
        var results = (data.features || []).map(function(f){
          var p = f.properties || {};
          // Build a clean US address string
          var parts = [];
          if(p.housenumber) parts.push(p.housenumber);
          if(p.street) parts.push(p.street);
          var line1 = parts.join(' ');
          var line2 = [p.city || p.locality || p.county, p.state, p.postcode].filter(Boolean).join(', ');
          if(!line1) line1 = p.name || '';
          var full = line2 ? (line1 + (line1 ? ', ' : '') + line2) : (p.name || line1);
          return {
            primary: line1 || p.name || '',
            secondary: line2 || p.country || '',
            full: full || (p.name || query),
            country: p.country || '',
            state: p.state || ''
          };
        }).filter(function(r){
          // Keep only US results
          return !r.country || r.country === 'United States' || r.country === 'USA';
        });
        callback(results);
      })
      .catch(function(){ callback([]); });
  }

  // ──────────────────────────────────────────────────────
  // HERO SEARCH (3 tabs)
  // ──────────────────────────────────────────────────────
  function initHeroSearch(){
    var card = document.querySelector('.hero-search-card, .hero-sc');
    if(!card) return;

    var tabs   = card.querySelectorAll('button.hsc-tab, .hsc-tab[data-sg-mode]');
    var input  = card.querySelector('input.hsc-input, input');
    var button = card.querySelector('.hsc-sbtn, button.hsc-btn');
    var hint   = card.querySelector('.hsc-hint');
    var fieldIco = card.querySelector('.hsc-field-ico');
    var dropdown = null;
    var lastQuery = '';
    if(!input) return;

    var mode = 'buy';
    function hideDropdown(){ if(dropdown) dropdown.style.display = 'none'; }

    var ICO = {
      buy: '<svg viewBox="0 0 24 24"><circle cx="10.5" cy="10.5" r="6.2"/><path d="m15.2 15.2 5.3 5.3"/></svg>',
      sell: '<svg viewBox="0 0 24 24"><path d="M3 11.2 12 3.5l9 7.7"/><path d="M6 10.2V20.5h12V10.2"/><path d="M10 20.5v-6h4v6"/></svg>',
      value: '<svg viewBox="0 0 24 24"><path d="M4 19.5V8.5"/><path d="M10 19.5V4.5"/><path d="M16 19.5v-7"/><path d="M22 19.5v-4"/></svg>'
    };

    function setMode(newMode){
      mode = newMode || 'buy';
      lastQuery = '';
      if(fieldIco) fieldIco.innerHTML = ICO[mode] || ICO.buy;
      if(mode === 'buy'){
        input.placeholder = 'City, neighborhood, ZIP code…';
        if(button) button.textContent = 'Search →';
        if(hint) hint.textContent = 'Search listings by city, neighborhood, or ZIP.';
      } else if(mode === 'sell'){
        input.placeholder = 'Enter your home address';
        if(button) button.textContent = 'Get Selling Plan →';
        if(hint) hint.textContent = 'Enter your address and Sigal will outline a selling strategy.';
      } else {
        input.placeholder = 'Enter your home address';
        if(button) button.textContent = "What's My Home Worth? →";
        if(hint) hint.textContent = 'Free, no-obligation valuation — Sigal replies within 24 hours.';
      }
      hideDropdown();
      input.value = '';
    }

    function activateTab(tab){
      if(!tab) return;
      tabs.forEach(function(t){
        t.classList.remove('on','active','is-active');
        t.setAttribute('aria-selected','false');
      });
      tab.classList.add('on');
      tab.setAttribute('aria-selected','true');
      setMode(tab.getAttribute('data-sg-mode') || 'buy');
    }

    window.sgSetSearchMode = function(el){
      var tab = el && el.closest ? el.closest('.hsc-tab') : el;
      activateTab(tab);
      return false;
    };

    tabs.forEach(function(tab){
      tab.addEventListener('pointerdown', function(e){
        e.preventDefault();
        activateTab(tab);
      });
      tab.addEventListener('click', function(e){
        e.preventDefault();
        e.stopPropagation();
        activateTab(tab);
      });
    });

    // Dropdown — appears below the input
    dropdown = document.createElement('div');
    dropdown.className = 'sg-search-dropdown';
    dropdown.style.cssText = [
      'display:none',
      'position:absolute',
      'top:calc(100% + 6px)',
      'left:0',
      'right:0',
      'background:#fff',
      'border-radius:6px',
      'box-shadow:0 12px 40px rgba(0,0,0,.18)',
      'max-height:380px',
      'overflow-y:auto',
      'z-index:2000',
      'border:1px solid rgba(27,42,74,.1)'
    ].join(';');
    var inputWrap = input.parentElement;
    inputWrap.style.position = 'relative';
    inputWrap.appendChild(dropdown);

    function showLoading(){
      dropdown.innerHTML = '<div style="padding:18px;text-align:center;color:#9CA3AE;font-size:.85rem;display:flex;align-items:center;gap:10px;justify-content:center"><span style="width:14px;height:14px;border:2px solid #E1E4E8;border-top-color:#1B2A4A;border-radius:50%;animation:sgSpin 0.8s linear infinite;display:inline-block"></span> Searching addresses…</div>';
      dropdown.style.display = 'block';
    }

    function showResults(items){
      if(!items.length){
        dropdown.innerHTML = '<div style="padding:18px;color:#9CA3AE;font-size:.85rem;font-style:italic;text-align:center">No matches — keep typing or try a different address</div>';
        dropdown.style.display = 'block';
        return;
      }
      dropdown.innerHTML = items.map(function(item, i){
        return '<div class="sg-dd-item" data-value="' + escapeAttr(item.full) + '" data-i="' + i + '" style="padding:14px 18px;cursor:pointer;border-bottom:1px solid rgba(27,42,74,.06);display:flex;align-items:flex-start;gap:14px;line-height:1.4;transition:background .15s">' +
          '<span style="font-size:1.1rem;flex-shrink:0;color:#1B2A4A"><svg class="i" viewBox="0 0 24 24" aria-hidden="true"><path d="M12 21s7-6.4 7-11.4A7 7 0 0 0 5 9.6C5 14.6 12 21 12 21z"/><circle cx="12" cy="9.6" r="2.2"/></svg></span>' +
          '<div style="flex:1;min-width:0">' +
            '<div style="font-weight:600;color:#1B2A4A;font-size:.95rem;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">' + escapeHtml(item.primary || item.full) + '</div>' +
            (item.secondary ? '<div style="font-size:.78rem;color:#9CA3AE;margin-top:2px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">' + escapeHtml(item.secondary) + '</div>' : '') +
          '</div>' +
        '</div>';
      }).join('');
      dropdown.style.display = 'block';
      dropdown.querySelectorAll('.sg-dd-item').forEach(function(el){
        el.addEventListener('mouseenter', function(){ this.style.background = '#F8F4EC'; });
        el.addEventListener('mouseleave', function(){ this.style.background = '#fff'; });
        el.addEventListener('mousedown', function(e){ e.preventDefault(); });
        el.addEventListener('click', function(){
          input.value = this.dataset.value;
          hideDropdown();
          submit();
        });
      });
    }

    function showCityResults(cities, query){
      if(!cities.length){ hideDropdown(); return; }
      dropdown.innerHTML = cities.map(function(c){
        var display = escapeHtml(c);
        if(query){
          var idx = c.toLowerCase().indexOf(query.toLowerCase());
          if(idx !== -1){
            display = escapeHtml(c.substring(0, idx)) +
              '<strong style="color:#1B2A4A">' + escapeHtml(c.substring(idx, idx + query.length)) + '</strong>' +
              escapeHtml(c.substring(idx + query.length));
          }
        }
        return '<div class="sg-dd-item" data-value="' + escapeAttr(c) + '" style="padding:14px 18px;cursor:pointer;border-bottom:1px solid rgba(27,42,74,.06);display:flex;align-items:center;gap:12px;font-size:.95rem;color:#1B2A4A;transition:background .15s">' +
          '<span style="color:#1B2A4A"><svg class="i" viewBox="0 0 24 24" aria-hidden="true"><path d="M12 21s7-6.4 7-11.4A7 7 0 0 0 5 9.6C5 14.6 12 21 12 21z"/><circle cx="12" cy="9.6" r="2.2"/></svg></span><span>' + display + '</span>' +
        '</div>';
      }).join('');
      dropdown.style.display = 'block';
      dropdown.querySelectorAll('.sg-dd-item').forEach(function(el){
        el.addEventListener('mouseenter', function(){ this.style.background = '#F8F4EC'; });
        el.addEventListener('mouseleave', function(){ this.style.background = '#fff'; });
        el.addEventListener('mousedown', function(e){ e.preventDefault(); });
        el.addEventListener('click', function(){
          input.value = this.dataset.value;
          hideDropdown();
          submit();
        });
      });
    }

    function escapeHtml(s){
      return String(s||'').replace(/[&<>"]/g, function(c){
        return {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c];
      });
    }
    function escapeAttr(s){
      return String(s||'').replace(/"/g, '&quot;');
    }

    // Input handler — different behavior per mode
    var debounceTimer;
    input.addEventListener('input', function(){
      var q = input.value.trim();
      clearTimeout(debounceTimer);

      if(mode === 'buy'){
        if(!q){ hideDropdown(); return; }
        var matches = ALL_CITIES.filter(function(c){
          return c.toLowerCase().indexOf(q.toLowerCase()) !== -1;
        }).slice(0, 8);
        showCityResults(matches, q);
      } else {
        // SELL or VALUE — address autocomplete via Photon
        if(q.length < 2){ hideDropdown(); return; }
        if(q === lastQuery) return;
        lastQuery = q;
        showLoading();
        debounceTimer = setTimeout(function(){
          searchAddresses(q, function(results){
            if(input.value.trim() !== q) return; // user kept typing
            showResults(results);
          });
        }, 280);
      }
    });

    input.addEventListener('focus', function(){
      if(mode === 'buy' && !input.value && ALL_CITIES.length){
        showCityResults(ALL_CITIES.slice(0, 8));
      }
    });

    document.addEventListener('click', function(e){
      if(!card.contains(e.target)) hideDropdown();
    });

    function submit(){
      var q = input.value.trim();
      if(mode === 'buy'){
        window.location.href = q
          ? 'properties.html?city=' + encodeURIComponent(q)
          : 'properties.html';
        return;
      }
      var dest = 'sell.html?mode=' + encodeURIComponent(mode);
      if(q) dest += '&address=' + encodeURIComponent(q);
      window.location.href = dest;
    }

    if(button) button.addEventListener('click', function(e){ e.preventDefault(); submit(); });
    input.addEventListener('keypress', function(e){
      if(e.key === 'Enter'){ e.preventDefault(); submit(); }
    });

    // Initial mode from default-active tab
    var activeTab = card.querySelector('.hsc-tab.on, .hsc-tab.active, .hsc-btn-tab.on');
    if(activeTab && activeTab.dataset.sgMode) setMode(activeTab.dataset.sgMode);

    // Inject spinner keyframes once
    if(!document.getElementById('sg-spin-keyframes')){
      var style = document.createElement('style');
      style.id = 'sg-spin-keyframes';
      style.textContent = '@keyframes sgSpin{to{transform:rotate(360deg)}}';
      document.head.appendChild(style);
    }
  }

  // ──────────────────────────────────────────────────────
  // PRE-FILL VALUATION FORM (from hero search address)
  // ──────────────────────────────────────────────────────
  function prefillFromURL(){
    var params = new URLSearchParams(window.location.search);
    var address = params.get('address');
    var mode = params.get('mode');
    var form = document.querySelector('.val-form');
    if(form && mode === 'sell'){
      var heading = form.querySelector('.val-form-title');
      if(heading) heading.textContent = 'Start My Selling Plan';
      var sub = form.querySelector('.val-form-sub');
      if(sub) sub.textContent = 'Tell Sigal about your home. She will follow up with a pricing strategy and next steps — no obligation.';
      var btn = form.querySelector('.fsubmit');
      if(btn) btn.textContent = 'Get My Selling Plan';
    }
    if(!address) return;
    setTimeout(function(){
      var addressInput = document.querySelector(
        'input[name="address"], input[placeholder*="address" i], input[placeholder*="property" i], input[name*="address" i]'
      );
      if(addressInput){
        addressInput.value = decodeURIComponent(address);
        addressInput.dispatchEvent(new Event('input',{bubbles:true}));
        var card = addressInput.closest('.form-card, .val-form');
        if(card) setTimeout(function(){
          card.scrollIntoView({behavior:'smooth',block:'center'});
        }, 400);
      }
    }, 200);
  }

  // ──────────────────────────────────────────────────────
  // FORMS — auto-wire to Netlify Forms
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

    card.querySelectorAll('input, select, textarea').forEach(function(field){
      if(field.name) return;
      var grp = field.closest('.fgrp, .field-group, .field, .form-row > div, .f2col > div');
      var lbl = grp ? grp.querySelector('label') : null;
      var raw = lbl ? lbl.textContent : (field.placeholder || field.type);
      field.name = nameFromLabel(raw) || ('field_' + Math.random().toString(36).slice(2,7));
    });

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
    .catch(function(){
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
        '<div style="width:72px;height:72px;border-radius:50%;background:#E8F5EE;display:inline-flex;align-items:center;justify-content:center;margin-bottom:1.5rem;font-size:2rem;color:#1B2A4A">✓</div>' +
        '<h3 style="font-family:'Archivo',sans-serif;font-size:1.8rem;color:#1B2A4A;margin:0 0 .6rem;font-weight:500">Thank You!</h3>' +
        '<p style="color:#56607A;font-size:.95rem;line-height:1.6;max-width:380px;margin:0 auto 2rem">' + msg + '</p>' +
        '<div style="display:flex;gap:.8rem;justify-content:center;flex-wrap:wrap">' +
          '<a href="tel:6177770485" style="background:#1B2A4A;color:#fff;padding:.85rem 1.6rem;text-decoration:none;font-size:.75rem;letter-spacing:.1em;text-transform:uppercase;font-weight:600;border-radius:2px"><svg class="i" viewBox="0 0 24 24" aria-hidden="true"><path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72c.13.96.36 1.9.7 2.81a2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45c.91.34 1.85.57 2.81.7A2 2 0 0 1 22 16.92z"/></svg> Call Now</a>' +
          '<a href="index.html" style="background:transparent;color:#1B2A4A;padding:.85rem 1.6rem;text-decoration:none;font-size:.75rem;letter-spacing:.1em;text-transform:uppercase;font-weight:600;border:1.5px solid #1B2A4A;border-radius:2px">← Back Home</a>' +
        '</div>' +
      '</div>';
  }

  function initForms(){
    document.querySelectorAll('.form-card, .cf-form-card, .val-form, .valuation-card, [class*="form-card"]').forEach(wireFormCard);
  }

  // ──────────────────────────────────────────────────────
  // PROPERTIES PAGE — ?city= filter
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
        badge.style.cssText = 'background:#1B2A4A;color:#fff;padding:14px 24px;display:flex;justify-content:space-between;align-items:center;margin-bottom:1.5rem;font-size:.85rem;letter-spacing:.04em;border-radius:2px;flex-wrap:wrap;gap:1rem';
        badge.innerHTML = '<span><svg class="i" viewBox="0 0 24 24" aria-hidden="true"><path d="M12 21s7-6.4 7-11.4A7 7 0 0 0 5 9.6C5 14.6 12 21 12 21z"/><circle cx="12" cy="9.6" r="2.2"/></svg> Filtered: <strong>' + cityFilter + '</strong> · ' + found + ' result' + (found===1?'':'s') + '</span><a href="properties.html" style="color:#F8F4EC;text-decoration:underline;font-size:.78rem;letter-spacing:.1em;text-transform:uppercase">✕ Clear filter</a>';
        grid.parentElement.insertBefore(badge, grid);
      }
    }, 200);
  }

  function sitePrefix(){
    var path = window.location.pathname.replace(/\/index\.html$/i, '').replace(/\/$/, '');
    var segs = path.split('/').filter(Boolean);
    if (segs.length && /\.html$/i.test(segs[segs.length - 1])) segs.pop();
    if (!segs.length) return '';
    return segs.map(function(){ return '../'; }).join('');
  }

  function initLocationListings(){
    var wrap = document.querySelector('[data-sg-city-listings]');
    if(!wrap) return;
    var city = wrap.getAttribute('data-sg-city-listings') || '';
    var grid = wrap.querySelector('.loc-list-grid');
    if(!grid || !city) return;
    fetch(sitePrefix() + 'listings/listings.json').then(function(r){ return r.json(); }).then(function(data){
      var list = (data.listings || []).filter(function(p){
        return (p.city || '').toLowerCase().indexOf(city.toLowerCase()) !== -1;
      }).slice(0, 6);
      if(!list.length){ wrap.style.display = 'none'; return; }
      grid.innerHTML = list.map(function(p){
        var st = (p.status || '').toLowerCase();
        var badgeClass = 'lb-sold';
        var badgeText = 'Sold';
        if(st === 'sale' || st === 'for sale' || st.indexOf('active') !== -1){ badgeClass = 'lb-sale'; badgeText = 'For Sale'; }
        else if(st.indexOf('pending') !== -1){ badgeClass = 'lb-pending'; badgeText = 'Pending'; }
        else if(st.indexOf('just') !== -1){ badgeClass = 'lb-jsold'; badgeText = 'Just Sold'; }
        var title = (p.title || '').replace(/</g,'');
        var price = p.price || '';
        var img = p.image || '';
        var beds = p.beds || '';
        var baths = p.baths || '';
        var size = p.size || '';
        return '<a class="loc-lcard" href="' + sitePrefix() + 'properties.html?city=' + encodeURIComponent(city) + '">' +
          '<div class="loc-lcard-img"><img src="' + img + '" alt="' + title + '" loading="lazy"/>' +
          '<span class="' + badgeClass + '">' + badgeText + '</span></div>' +
          '<div class="loc-lcard-body"><div class="loc-lcard-price">' + price + '</div>' +
          '<div class="loc-lcard-title">' + title + '</div>' +
          '<div class="loc-lcard-meta">' + beds + ' bd · ' + baths + ' ba · ' + size + '</div></div></a>';
      }).join('');
    }).catch(function(){ wrap.style.display = 'none'; });
  }

  function boot(){
    initHeroSearch();
    prefillFromURL();
    initForms();
    initPropertyFilter();
    initLocationListings();
  }

  if(document.readyState === 'loading'){
    document.addEventListener('DOMContentLoaded', boot);
  } else {
    boot();
  }
})();
