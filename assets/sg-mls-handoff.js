/**
 * Sigal Concierge ↔ BeachesMLS handoff
 *
 * Path discovery (Aug 2026) for https://link.flexmls.com/1zc76kndtgku,15:
 * Searching "Delray Beach" in Flexmls did NOT change the address bar.
 * Search state is internal → Path B (clipboard + paste bar).
 *
 * If Flexmls later exposes URL params, set searchUrlTemplate / mlsNumberUrlTemplate
 * and path to 'A'. Console: mlsHandoffDiagnostic()
 */
(function(global){
  'use strict';

  var MLS_CONFIG = {
    // 'A' = load MLS URL already filtered; 'B' = clipboard + paste UI
    path: 'B',
    baseEmbed: 'https://link.flexmls.com/1zc76kndtgku,15',
    // Path A templates — use {q} placeholder. Leave null while on Path B.
    searchUrlTemplate: null,
    // e.g. 'https://link.flexmls.com/...?searchText={q}'
    mlsNumberUrlTemplate: null,
    // e.g. 'https://link.flexmls.com/...?mls={q}'
    searchPage: 'search.html',
    storageKey: 'sg_hero_query',
    storageMetaKey: 'sg_hero_query_meta'
  };

  function classifyQuery(raw){
    var q = String(raw || '').trim();
    if(!q) return { type: 'empty', value: '' };
    var compact = q.replace(/\s+/g, '');
    // MLS numbers: RX-11012345, A1234567, or 7–10 digit ids
    if(/^(RX-?|A)?\d{6,10}$/i.test(compact) || /^RX-?\d+/i.test(q)){
      return { type: 'mls', value: q.toUpperCase() };
    }
    // ZIP (5 or ZIP+4)
    if(/^\d{5}(-\d{4})?$/.test(q)){
      return { type: 'zip', value: q };
    }
    // Street address heuristic: starts with a number
    if(/^\d+\s+\S+/.test(q)){
      return { type: 'address', value: q };
    }
    return { type: 'city', value: q };
  }

  function recordHeroQuery(raw, extra){
    var classified = classifyQuery(raw);
    if(!classified.value) return null;
    var meta = {
      query: classified.value,
      type: classified.type,
      at: new Date().toISOString(),
      source: (extra && extra.source) || 'concierge-hero'
    };
    try {
      sessionStorage.setItem(MLS_CONFIG.storageKey, classified.value);
      sessionStorage.setItem(MLS_CONFIG.storageMetaKey, JSON.stringify(meta));
      // Compat with existing carry bar
      sessionStorage.setItem('sg_concierge_q', classified.value);
    } catch(e){}
    global.sgLastHeroQuery = meta;
    return meta;
  }

  function getStoredQuery(){
    try {
      var q = sessionStorage.getItem(MLS_CONFIG.storageKey) || sessionStorage.getItem('sg_concierge_q') || '';
      return String(q || '').trim();
    } catch(e){ return ''; }
  }

  function getStoredMeta(){
    try {
      return JSON.parse(sessionStorage.getItem(MLS_CONFIG.storageMetaKey) || 'null');
    } catch(e){ return null; }
  }

  function buildMlsUrl(meta){
    if(!meta || !meta.query) return MLS_CONFIG.baseEmbed;
    var tpl = (meta.type === 'mls' && MLS_CONFIG.mlsNumberUrlTemplate)
      ? MLS_CONFIG.mlsNumberUrlTemplate
      : MLS_CONFIG.searchUrlTemplate;
    if(MLS_CONFIG.path === 'A' && tpl){
      return tpl.replace(/\{q\}/g, encodeURIComponent(meta.query));
    }
    return MLS_CONFIG.baseEmbed;
  }

  function copyToClipboard(text){
    if(!text) return Promise.resolve(false);
    if(navigator.clipboard && navigator.clipboard.writeText){
      return navigator.clipboard.writeText(text).then(function(){
        try { sessionStorage.setItem('sg_concierge_copied', '1'); } catch(e){}
        return true;
      }).catch(function(){ return false; });
    }
    return Promise.resolve(false);
  }

  /**
   * Main handoff from hero Concierge submit.
   * mode: 'embed' (same-tab search.html) | 'tab' (new Flexmls tab)
   */
  function handoff(raw, opts){
    opts = opts || {};
    var meta = recordHeroQuery(raw, opts);
    var term = meta ? meta.query : '';
    var openTab = !!opts.newTab;

    return copyToClipboard(term).then(function(copied){
      if(openTab){
        try { sessionStorage.setItem('sg_mls_opened_tab', '1'); } catch(e){}
        var url = buildMlsUrl(meta);
        global.open(url, '_blank', 'noopener,noreferrer');
        // Stay on / return to search page with paste UI
        var dest = MLS_CONFIG.searchPage;
        if(term) dest += '?q=' + encodeURIComponent(term) + (copied ? '&copied=1' : '');
        if(opts.stayOnPage) return { meta: meta, copied: copied, url: url };
        global.location.href = dest;
        return { meta: meta, copied: copied, url: url };
      }

      // Same-tab: Path A would set iframe src with params; Path B uses search.html chrome
      if(MLS_CONFIG.path === 'A' && meta){
        var mlsUrl = buildMlsUrl(meta);
        try { sessionStorage.setItem('sg_mls_embed_src', mlsUrl); } catch(e){}
      }

      var page = MLS_CONFIG.searchPage;
      if(term) page += '?q=' + encodeURIComponent(term);
      global.location.href = page;
      return { meta: meta, copied: copied };
    });
  }

  function applyEmbedSrc(){
    var frame = document.getElementById('mlsFrame');
    var tab = document.getElementById('mlsOpenTab');
    var src = MLS_CONFIG.baseEmbed;
    try {
      var override = sessionStorage.getItem('sg_mls_embed_src');
      if(override && MLS_CONFIG.path === 'A') src = override;
    } catch(e){}
    var params = new URLSearchParams(global.location.search);
    var q = params.get('q') || getStoredQuery();
    if(MLS_CONFIG.path === 'A' && q){
      src = buildMlsUrl({ query: q, type: classifyQuery(q).type });
    }
    if(frame && !frame.getAttribute('src')) frame.src = src;
    if(tab){
      tab.href = src;
      tab.rel = 'noopener noreferrer';
      tab.target = '_blank';
    }
    return src;
  }

  function showCarryBar(){
    var params = new URLSearchParams(global.location.search);
    var term = params.get('q') || getStoredQuery();
    var bar = document.getElementById('mlsCarryBar');
    var input = document.getElementById('mlsCarryInput');
    var copyBtn = document.getElementById('mlsCarryCopy');
    var msg = document.getElementById('mlsCarryMsg');
    var hint = document.getElementById('mlsSearchHint');
    if(!term || !bar || !input) return;

    bar.hidden = false;
    input.value = term;
    if(hint){
      hint.textContent = 'Your search is ready — paste it into the MLS box below to filter live listings.';
    }
    var copied = params.get('copied') === '1';
    try { if(sessionStorage.getItem('sg_concierge_copied') === '1') copied = true; } catch(e){}
    if(msg){
      msg.textContent = copied
        ? 'Copied: "' + term + '" — tap the MLS search box below, then Paste.'
        : 'Tap Copy, then click the MLS search box and Paste.';
    }
    if(copyBtn && !copyBtn.dataset.wired){
      copyBtn.dataset.wired = '1';
      copyBtn.addEventListener('click', function(){
        copyToClipboard(term).then(function(ok){
          if(msg){
            msg.textContent = ok
              ? 'Copied — tap the MLS search box below, then Paste.'
              : 'Select the text above, copy it, then paste into the MLS search box.';
          }
        });
      });
    }
    input.addEventListener('focus', function(){ input.select(); });
  }

  function injectHeroQueryIntoForms(){
    var meta = getStoredMeta();
    var q = (meta && meta.query) || getStoredQuery();
    if(!q) return;
    document.querySelectorAll('form, .form-card, .cf-form-card, .val-form').forEach(function(card){
      var existing = card.querySelector('[name="hero_query"], [name="searched"]');
      if(existing){
        existing.value = q;
        return;
      }
      var hidden = document.createElement('input');
      hidden.type = 'hidden';
      hidden.name = 'hero_query';
      hidden.value = q;
      if(card.tagName === 'FORM') card.appendChild(hidden);
      else card.appendChild(hidden);
    });
  }

  function initReturnToTabPrompt(){
    var tip = document.getElementById('mlsTipField') || document.querySelector('[name="mls_tip"], [data-sg-mls-tip]');
    if(!tip) return;
    document.addEventListener('visibilitychange', function(){
      if(document.visibilityState !== 'visible') return;
      var opened = false;
      try { opened = sessionStorage.getItem('sg_mls_opened_tab') === '1'; } catch(e){}
      if(!opened) return;
      try { sessionStorage.removeItem('sg_mls_opened_tab'); } catch(e){}
      tip.placeholder = 'Which one caught your eye? MLS # or address';
      try {
        tip.scrollIntoView({ behavior: 'smooth', block: 'center' });
        tip.focus();
      } catch(e){}
    });
  }

  function initSearchPage(){
    if(!document.getElementById('mlsFrame')) return;
    applyEmbedSrc();
    showCarryBar();
    injectHeroQueryIntoForms();
    initReturnToTabPrompt();

    var openTab = document.getElementById('mlsOpenTab');
    if(openTab && !openTab.dataset.handoffWired){
      openTab.dataset.handoffWired = '1';
      openTab.addEventListener('click', function(){
        try { sessionStorage.setItem('sg_mls_opened_tab', '1'); } catch(e){}
      });
    }
  }

  global.sgRecordHeroQuery = recordHeroQuery;
  global.sgMlsHandoff = handoff;
  global.sgClassifyMlsQuery = classifyQuery;
  global.sgGetHeroQuery = getStoredQuery;
  global.sgInitMlsFrame = function(){
    applyEmbedSrc();
    showCarryBar();
  };

  global.mlsHandoffDiagnostic = function(){
    /* eslint-disable no-console */
    console.log('%cMLS Handoff Diagnostic', 'font-weight:bold;font-size:14px');
    console.log('1. Open', MLS_CONFIG.baseEmbed, 'in a normal tab.');
    console.log('2. Search "Delray Beach" in THEIR box. Watch the address bar.');
    console.log('3. If a ?param= appears, set MLS_CONFIG.searchUrlTemplate and path:"A".');
    console.log('4. Repeat with an MLS# — often a different parameter.');
    console.log('Current config:', JSON.parse(JSON.stringify(MLS_CONFIG)));
    console.log('Stored query:', getStoredQuery(), getStoredMeta());
    console.log('Discovery (Aug 2026): URL did NOT change after Delray Beach search → Path B.');
    /* eslint-enable no-console */
    return MLS_CONFIG;
  };

  if(document.readyState === 'loading'){
    document.addEventListener('DOMContentLoaded', function(){
      initSearchPage();
      injectHeroQueryIntoForms();
    });
  } else {
    initSearchPage();
    injectHeroQueryIntoForms();
  }
})(window);
