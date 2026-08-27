// ═══════════════════════════════════════════════════════════════
// SIGAL GROUP REALTY — UNIFIED APP LOGIC v2
// • 3-tab hero search (Buy / Sell / Home Value)
// • Real-time address autocomplete via Photon (open-source OSM)
// • Form auto-wiring to Netlify Forms
// ═══════════════════════════════════════════════════════════════
(function(){
  'use strict';

  var ALL_CITIES = [];

  function escapeHtml(s){
    return String(s || '').replace(/[&<>"']/g, function(c){
      return {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c];
    });
  }
  function escapeAttr(s){
    return escapeHtml(s);
  }
  function safeImgUrl(u){
    var s = String(u || '').trim();
    return /^https?:\/\//i.test(s) ? s : '';
  }

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
  // ADDRESS TYPEAHEAD
  // Photon (OSM) returns matching places as the client types.
  // OpenFreeMap then draws those coordinates on a MapLibre preview.
  // ──────────────────────────────────────────────────────
  var FL_BIAS_LAT = 26.358;
  var FL_BIAS_LON = -80.087;

  // MapLibre is ~250KB, so it is fetched the first time someone uses the search field
  var MAPLIBRE_JS = 'https://unpkg.com/maplibre-gl@5/dist/maplibre-gl.js';
  var MAPLIBRE_CSS = 'https://unpkg.com/maplibre-gl@5/dist/maplibre-gl.css';
  var maplibrePromise = null;

  function loadMapLibre(){
    if(window.maplibregl) return Promise.resolve(window.maplibregl);
    if(maplibrePromise) return maplibrePromise;
    maplibrePromise = new Promise(function(resolve, reject){
      var link = document.createElement('link');
      link.rel = 'stylesheet';
      link.href = MAPLIBRE_CSS;
      document.head.appendChild(link);
      var s = document.createElement('script');
      s.src = MAPLIBRE_JS;
      s.async = true;
      s.onload = function(){ resolve(window.maplibregl); };
      s.onerror = function(){ maplibrePromise = null; reject(new Error('maplibre failed')); };
      document.head.appendChild(s);
    });
    return maplibrePromise;
  }

  var geoCache = {};

  var geoController = null;

  function searchAddresses(query, callback){
    if(!query || query.length < 2){ callback([]); return; }
    var key = query.toLowerCase();
    if(geoCache[key]){ callback(geoCache[key]); return; }
    var url = 'https://photon.komoot.io/api/'
      + '?q=' + encodeURIComponent(query)
      + '&limit=7'
      + '&lat=' + FL_BIAS_LAT + '&lon=' + FL_BIAS_LON
      + '&bbox=-87.6,24.4,-79.9,31.1'
      + '&lang=en';
    if(geoController) geoController.abort();
    geoController = (typeof AbortController !== 'undefined') ? new AbortController() : null;
    fetch(url, geoController ? { signal: geoController.signal } : undefined)
      .then(function(r){ return r.json(); })
      .then(function(data){
        var results = (data.features || []).map(function(f){
          var p = f.properties || {};
          var coords = (f.geometry && f.geometry.coordinates) || [];
          var parts = [];
          if(p.housenumber) parts.push(p.housenumber);
          if(p.street) parts.push(p.street);
          var line1 = parts.join(' ');
          var city = p.city || p.locality || p.county || '';
          var line2 = [city, p.state, p.postcode].filter(Boolean).join(', ');
          if(!line1) line1 = p.name || city || '';
          var full = line2 ? (line1 + (line1 ? ', ' : '') + line2) : (p.name || line1);
          return {
            primary: line1 || p.name || '',
            secondary: line2 || p.country || '',
            full: full || (p.name || query),
            country: p.country || '',
            state: p.state || '',
            city: city,
            lon: coords.length ? coords[0] : null,
            lat: coords.length > 1 ? coords[1] : null
          };
        }).filter(function(r){
          return !r.country || r.country === 'United States' || r.country === 'USA';
        });
        results.sort(function(a, b){
          var af = /florida|^fl$/i.test(a.state || '') ? 0 : 1;
          var bf = /florida|^fl$/i.test(b.state || '') ? 0 : 1;
          return af - bf;
        });
        geoCache[key] = results;
        callback(results);
      })
      .catch(function(err){
        if(err && err.name === 'AbortError') return;
        callback([]);
      });
  }

  // ──────────────────────────────────────────────────────
  // HERO SEARCH (4 tabs — Buy / Sell / Home Value / Concierge MLS)
  // ──────────────────────────────────────────────────────
  function initHeroSearch(){
    var card = document.querySelector('.hero-search-card, .hero-sc');
    if(!card) return;

    var tabs   = card.querySelectorAll('button.hsc-tab, .hsc-tab[data-sg-mode]');
    var input  = card.querySelector('input.hsc-input, input');
    var button = card.querySelector('.hsc-sbtn, button.hsc-btn');
    var hint   = card.querySelector('.hsc-hint');
    var fieldIco = card.querySelector('.hsc-field-ico');
    var lastQuery = '';
    if(!input) return;

    var mode = 'buy';
    var dropdown = null;
    var activeIndex = -1;
    var isTouch = window.matchMedia && window.matchMedia('(pointer: coarse)').matches;

    var ICO = {
      buy: '<svg viewBox="0 0 24 24"><circle cx="10.5" cy="10.5" r="6.2"/><path d="m15.2 15.2 5.3 5.3"/></svg>',
      sell: '<svg viewBox="0 0 24 24"><path d="M3 11.2 12 3.5l9 7.7"/><path d="M6 10.2V20.5h12V10.2"/><path d="M10 20.5v-6h4v6"/></svg>',
      value: '<svg viewBox="0 0 24 24"><path d="M4 19.5V8.5"/><path d="M10 19.5V4.5"/><path d="M16 19.5v-7"/><path d="M22 19.5v-4"/></svg>',
      concierge: '<svg viewBox="0 0 24 24"><rect x="4" y="4" width="7" height="7" rx="1"/><rect x="13" y="4" width="7" height="7" rx="1"/><rect x="4" y="13" width="7" height="7" rx="1"/><rect x="13" y="13" width="7" height="7" rx="1"/></svg>'
    };

    function setMode(newMode){
      mode = newMode || 'buy';
      lastQuery = '';
      lastPicked = null;
      if(fieldIco) fieldIco.innerHTML = ICO[mode] || ICO.buy;
      if(mode === 'buy'){
        input.placeholder = 'City, neighborhood, ZIP code…';
        if(button) button.textContent = 'Search →';
        if(hint) hint.textContent = 'Start typing a city or street — matches appear as you type.';
      } else if(mode === 'sell'){
        input.placeholder = 'Enter your home address';
        if(button) button.textContent = 'Get Selling Plan →';
        if(hint) hint.textContent = 'Type your address — we will pin it on the map.';
      } else if(mode === 'concierge'){
        input.placeholder = 'City, address, or MLS #…';
        if(button) button.textContent = 'Concierge Search →';
        if(hint) hint.textContent = 'Full BeachesMLS market — your search copies automatically for the next page.';
      } else {
        input.placeholder = 'Enter your home address';
        if(button) button.textContent = "What's My Home Worth? →";
        if(hint) hint.textContent = 'Type your address — we will pin it on the map.';
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

    // Dropdown + OpenFreeMap preview (MapLibre, Liberty style)
    dropdown = document.createElement('div');
    dropdown.className = 'sg-search-dropdown';
    dropdown.setAttribute('role', 'listbox');
    var listEl = document.createElement('div');
    listEl.className = 'sg-dd-list';
    var mapWrap = document.createElement('div');
    mapWrap.className = 'sg-dd-map-wrap';
    mapWrap.hidden = true;
    var mapEl = document.createElement('div');
    mapEl.className = 'sg-dd-map';
    mapEl.setAttribute('aria-hidden', 'true');
    mapWrap.appendChild(mapEl);
    dropdown.appendChild(listEl);
    dropdown.appendChild(mapWrap);
    var row = input.closest('.hsc-input-row') || input.parentElement;
    row.style.position = 'relative';
    row.appendChild(dropdown);

    var previewMap = null;
    var previewMarker = null;
    var lastItems = [];
    var lastPicked = null;

    // Size the panel to the room actually available, and only flip it above the
    // field when there is genuinely no space below (otherwise it covers the tabs)
    function placeDropdown(){
      var r = input.getBoundingClientRect();
      var gap = 20;
      var below = window.innerHeight - r.bottom - gap;
      var above = r.top - gap;
      var flip = below < 190 && above > below;
      dropdown.classList.toggle('is-above', flip);

      var room = Math.max(150, Math.min(320, flip ? above : below));
      var mapH = mapWrap.hidden ? 0 : Math.round(Math.min(148, Math.max(88, room * 0.42)));
      if(mapH){
        mapWrap.style.height = mapH + 'px';
        mapEl.style.height = mapH + 'px';
      }
      listEl.style.maxHeight = Math.max(92, room - mapH) + 'px';
      if(previewMap) previewMap.resize();
    }

    function showDropdown(){
      dropdown.style.display = 'block';
      input.setAttribute('aria-expanded', 'true');
      document.body.classList.add('sg-suggesting');
      placeDropdown();
      if(previewMap){
        requestAnimationFrame(function(){ previewMap.resize(); });
      }
    }

    function hideDropdown(){
      if(dropdown) dropdown.style.display = 'none';
      input.setAttribute('aria-expanded', 'false');
      input.removeAttribute('aria-activedescendant');
      document.body.classList.remove('sg-suggesting');
      activeIndex = -1;
    }

    function ensurePreviewMap(){
      if(previewMap) return Promise.resolve(null);
      return loadMapLibre().then(function(){
        if(previewMap || !window.maplibregl) return;
        previewMap = new maplibregl.Map({
          container: mapEl,
          style: 'https://tiles.openfreemap.org/styles/liberty',
          center: [FL_BIAS_LON, FL_BIAS_LAT],
          zoom: 11,
          attributionControl: { compact: true },
          scrollZoom: false,
          dragRotate: false,
          pitchWithRotate: false
        });
        previewMarker = new maplibregl.Marker({ color: '#1B2A4A' })
          .setLngLat([FL_BIAS_LON, FL_BIAS_LAT])
          .addTo(previewMap);
      }).catch(function(){ mapWrap.hidden = true; });
    }

    function flyToItem(item){
      if(!item || item.lon == null || item.lat == null){
        mapWrap.hidden = true;
        return;
      }
      mapWrap.hidden = false;
      ensurePreviewMap().then(function(){
        if(!previewMap) return;
        var zoom = item.isCity ? 12 : 15.4;
        previewMap.jumpTo({ center: [item.lon, item.lat], zoom: zoom });
        if(previewMarker) previewMarker.setLngLat([item.lon, item.lat]);
        previewMap.resize();
        placeDropdown();
      });
    }

    function setActive(i, scroll){
      var nodes = listEl.querySelectorAll('.sg-dd-item');
      if(!nodes.length) return;
      activeIndex = i;
      nodes.forEach(function(node, n){
        var on = n === i;
        node.classList.toggle('is-active', on);
        if(on){
          input.setAttribute('aria-activedescendant', node.id);
          if(scroll && node.scrollIntoView) node.scrollIntoView({ block: 'nearest' });
        }
      });
      flyToItem(lastItems[i]);
    }

    function showLoading(){
      listEl.innerHTML = '<div class="sg-dd-loading"><span style="width:14px;height:14px;border:2px solid #E1E4E8;border-top-color:#1B2A4A;border-radius:50%;animation:sgSpin .8s linear infinite;display:inline-block;margin-right:8px;vertical-align:middle"></span> Finding addresses…</div>';
      mapWrap.hidden = true;
      showDropdown();
    }

    function showResults(items){
      lastItems = items || [];
      if(!lastItems.length){
        listEl.innerHTML = '<div class="sg-dd-empty">No matches — keep typing a street, city, or ZIP</div>';
        mapWrap.hidden = true;
        showDropdown();
        return;
      }
      listEl.innerHTML = lastItems.map(function(item, i){
        var ico = item.isCity
          ? '<path d="M3 11.2 12 3.5l9 7.7"/><path d="M6 10.2V20.5h12V10.2"/><path d="M10 20.5v-6h4v6"/>'
          : '<path d="M12 21s7-6.4 7-11.4A7 7 0 0 0 5 9.6C5 14.6 12 21 12 21z"/><circle cx="12" cy="9.6" r="2.2"/>';
        return '<div class="sg-dd-item" role="option" id="sg-dd-opt-' + i + '" aria-selected="false"' +
          ' data-value="' + escapeAttr(item.full) + '" data-i="' + i + '">' +
          '<svg class="i" viewBox="0 0 24 24" aria-hidden="true">' + ico + '</svg>' +
          '<div style="flex:1;min-width:0">' +
            '<div class="sg-dd-pri">' + escapeHtml(item.primary || item.full) + '</div>' +
            (item.secondary ? '<div class="sg-dd-sec">' + escapeHtml(item.secondary) + '</div>' : '') +
          '</div></div>';
      }).join('');
      activeIndex = -1;
      showDropdown();
      var firstWithCoords = lastItems.filter(function(it){ return it.lon != null; })[0];
      flyToItem(firstWithCoords);
      listEl.querySelectorAll('.sg-dd-item').forEach(function(el){
        el.addEventListener('mouseenter', function(){
          if(isTouch) return;
          setActive(Number(this.dataset.i), false);
        });
        el.addEventListener('mousedown', function(e){ e.preventDefault(); });
        el.addEventListener('click', function(){
          var i = Number(this.dataset.i);
          // On touch there is no hover, so the first tap previews the pin and
          // fills the field; the Search button commits it.
          if(isTouch && activeIndex !== i){
            setActive(i, false);
            lastPicked = lastItems[i] || null;
            input.value = this.dataset.value;
            lastQuery = input.value.trim();
            if(hint) hint.textContent = 'Tap again, or press Search, to continue.';
            return;
          }
          choose(i);
        });
      });
    }

    function choose(i){
      var item = lastItems[i];
      if(!item) return;
      lastPicked = item;
      input.value = item.full;
      hideDropdown();
      submit();
    }

    function cityItem(c){
      var sub = mode === 'concierge'
        ? 'Search all MLS listings in this area'
        : 'Search listings in this city';
      return {
        primary: c,
        secondary: sub,
        full: c,
        city: c,
        isCity: true
      };
    }

    function escapeHtml(s){
      return String(s||'').replace(/[&<>"]/g, function(c){
        return {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c];
      });
    }
    function escapeAttr(s){
      return String(s||'').replace(/"/g, '&quot;');
    }

    var debounceTimer;
    input.addEventListener('input', function(){
      var q = input.value.trim();
      lastPicked = null;
      clearTimeout(debounceTimer);
      if(q.length < 2){ hideDropdown(); lastQuery = ''; return; }
      if(q === lastQuery) return;
      lastQuery = q;
      showLoading();
      debounceTimer = setTimeout(function(){
        searchAddresses(q, function(results){
          if(input.value.trim() !== q) return;
          var items = results;
          if(mode === 'buy' || mode === 'concierge'){
            var cityHits = ALL_CITIES.filter(function(c){
              return c.toLowerCase().indexOf(q.toLowerCase()) !== -1;
            }).slice(0, 3).map(cityItem);
            items = cityHits.concat(results).slice(0, 8);
          }
          showResults(items);
        });
      }, 260);
    });

    input.addEventListener('focus', function(){
      loadMapLibre().catch(function(){});
      if(dropdown.style.display === 'block') return;
      if(mode === 'buy' && !input.value && ALL_CITIES.length){
        showResults(ALL_CITIES.slice(0, 6).map(cityItem));
      }
      if(mode === 'concierge' && !input.value && ALL_CITIES.length){
        showResults(ALL_CITIES.slice(0, 6).map(function(c){
          return {
            primary: c,
            secondary: 'Search all MLS listings in this area',
            full: c,
            city: c,
            isCity: true
          };
        }));
      }
    });

    input.addEventListener('keydown', function(e){
      var open = dropdown.style.display === 'block';
      if(e.key === 'Escape'){
        hideDropdown();
        return;
      }
      if(e.key === 'ArrowDown' || e.key === 'ArrowUp'){
        if(!open || !lastItems.length) return;
        e.preventDefault();
        var next = e.key === 'ArrowDown' ? activeIndex + 1 : activeIndex - 1;
        if(next >= lastItems.length) next = 0;
        if(next < 0) next = lastItems.length - 1;
        setActive(next, true);
        return;
      }
      if(e.key === 'Enter'){
        e.preventDefault();
        if(open && activeIndex >= 0){ choose(activeIndex); return; }
        submit();
      }
    });

    function reposition(){
      if(dropdown.style.display === 'block') placeDropdown();
    }
    window.addEventListener('resize', reposition);
    window.addEventListener('scroll', reposition, { passive: true });

    document.addEventListener('click', function(e){
      if(!card.contains(e.target)) hideDropdown();
    });

    function submit(){
      var q = input.value.trim();
      if(mode === 'concierge'){
        var term = q;
        if(lastPicked){
          if(lastPicked.full) term = lastPicked.full;
          else if(lastPicked.city) term = lastPicked.city;
        }
        if(term){
          try {
            sessionStorage.setItem('sg_concierge_q', term);
            sessionStorage.removeItem('sg_concierge_copied');
          } catch(e){}
          if(navigator.clipboard && navigator.clipboard.writeText){
            navigator.clipboard.writeText(term).then(function(){
              try { sessionStorage.setItem('sg_concierge_copied', '1'); } catch(e){}
            }).catch(function(){});
          }
        }
        window.location.href = term
          ? 'search.html?q=' + encodeURIComponent(term)
          : 'search.html';
        return;
      }
      if(mode === 'buy'){
        var city = (lastPicked && lastPicked.city) ? lastPicked.city : q;
        window.location.href = city
          ? 'properties.html?city=' + encodeURIComponent(city)
          : 'properties.html';
        return;
      }
      var dest = 'sell.html?mode=' + encodeURIComponent(mode);
      if(q) dest += '&address=' + encodeURIComponent(q);
      if(lastPicked && lastPicked.lat != null && lastPicked.lon != null){
        dest += '&lat=' + lastPicked.lat + '&lon=' + lastPicked.lon;
      }
      window.location.href = dest;
    }

    if(button) button.addEventListener('click', function(e){ e.preventDefault(); submit(); });

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
        '<h3 style="font-family:Archivo,sans-serif;font-size:1.8rem;color:#1B2A4A;margin:0 0 .6rem;font-weight:500">Thank You!</h3>' +
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

  function buildCityFilterBadge(cityFilter, found){
    var badge = document.createElement('div');
    badge.id = 'cityFilterBadge';
    badge.style.cssText = 'background:#1B2A4A;color:#F8F4EC;padding:14px 24px;display:flex;justify-content:space-between;align-items:center;margin-bottom:1.5rem;border-radius:2px;font-size:.85rem;letter-spacing:.04em;flex-wrap:wrap;gap:1rem';
    var left = document.createElement('span');
    left.insertAdjacentHTML('afterbegin', '<svg class="i" viewBox="0 0 24 24" aria-hidden="true"><path d="M12 21s7-6.4 7-11.4A7 7 0 0 0 5 9.6C5 14.6 12 21 12 21z"/><circle cx="12" cy="9.6" r="2.2"/></svg> ');
    left.appendChild(document.createTextNode('Filtered by location: '));
    var strong = document.createElement('strong');
    strong.textContent = cityFilter;
    left.appendChild(strong);
    left.appendChild(document.createTextNode(' · ' + found + ' propert' + (found === 1 ? 'y' : 'ies') + ' found'));
    var clear = document.createElement('a');
    clear.href = 'properties.html';
    clear.style.cssText = 'color:#F8F4EC;text-decoration:underline;font-size:.78rem;letter-spacing:.1em;text-transform:uppercase';
    clear.textContent = '✕ Clear filter';
    badge.appendChild(left);
    badge.appendChild(clear);
    return badge;
  }

  function buildCityEmptyState(cityFilter){
    var box = document.createElement('div');
    box.className = 'state-box';
    box.style.cssText = 'grid-column:1/-1;text-align:center;padding:4rem 2rem;color:#9CA3AE';
    box.insertAdjacentHTML('afterbegin', '<svg class="i" style="width:42px;height:42px;color:#1B2A4A" viewBox="0 0 24 24" aria-hidden="true"><path d="M3 11.2 12 3.5l9 7.7"/><path d="M6 10.2V20.5h12V10.2"/><path d="M10 20.5v-6h4v6"/></svg>');
    var title = document.createElement('div');
    title.style.cssText = 'font-family:\'Archivo\',sans-serif;font-size:1.3rem;color:#56607A;margin:1rem 0 .5rem';
    title.textContent = 'No listings in ' + cityFilter + ' yet';
    var sub = document.createElement('div');
    sub.style.cssText = 'font-size:.85rem;margin-bottom:1.5rem';
    sub.textContent = 'Try browsing all listings, or contact Sigal for off-market opportunities.';
    var link = document.createElement('a');
    link.href = 'properties.html';
    link.style.cssText = 'background:#1B2A4A;color:#F8F4EC;padding:12px 24px;text-decoration:none;font-size:.75rem;letter-spacing:.1em;text-transform:uppercase;display:inline-block';
    link.textContent = 'View All Properties';
    box.appendChild(title);
    box.appendChild(sub);
    box.appendChild(link);
    return box;
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
        grid.parentElement.insertBefore(buildCityFilterBadge(cityFilter, found), grid);
      }
      if(found === 0){
        grid.textContent = '';
        grid.appendChild(buildCityEmptyState(cityFilter));
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
        var title = escapeHtml(p.title || '');
        var price = escapeHtml(p.price || '');
        var img = safeImgUrl(p.image);
        var beds = escapeHtml(p.beds || '');
        var baths = escapeHtml(p.baths || '');
        var size = escapeHtml(p.size || '');
        return '<a class="loc-lcard" href="' + sitePrefix() + 'properties.html?city=' + encodeURIComponent(city) + '">' +
          '<div class="loc-lcard-img"><img src="' + escapeAttr(img) + '" alt="' + title + '" loading="lazy"/>' +
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
