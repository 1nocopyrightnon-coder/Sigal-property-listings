// Compat layer — prefer assets/sg-mls-handoff.js (Path A/B discovery + attribution).
// Kept so older search.html includes still work if handoff is missing.
(function(){
  'use strict';
  if(typeof window.sgInitMlsFrame === 'function' && window.sgMlsHandoff) return;

  function getQuery(){
    var params = new URLSearchParams(window.location.search);
    var q = params.get('q') || params.get('city') || '';
    if(!q){
      try { q = sessionStorage.getItem('sg_concierge_q') || sessionStorage.getItem('sg_hero_query') || ''; } catch(e){}
    }
    return String(q || '').trim();
  }

  function copyText(text, msgEl){
    if(!text) return;
    function done(ok){
      if(msgEl){
        msgEl.textContent = ok
          ? 'Copied — tap the MLS search box below, then Paste.'
          : 'Select the text above, copy, then paste into the MLS search box below.';
      }
    }
    if(navigator.clipboard && navigator.clipboard.writeText){
      navigator.clipboard.writeText(text).then(function(){ done(true); }).catch(function(){ done(false); });
    } else {
      done(false);
    }
  }

  window.sgInitMlsCarry = function(){
    var term = getQuery();
    var bar = document.getElementById('mlsCarryBar');
    var input = document.getElementById('mlsCarryInput');
    var copyBtn = document.getElementById('mlsCarryCopy');
    var msg = document.getElementById('mlsCarryMsg');
    var hint = document.getElementById('mlsSearchHint');
    if(!term || !bar || !input) return;

    bar.hidden = false;
    input.value = term;
    if(hint){
      hint.textContent = 'Your search is ready below — paste it into the MLS box to see live listings.';
    }
    var copied = false;
    try { copied = sessionStorage.getItem('sg_concierge_copied') === '1'; } catch(e){}
    if(copied && msg){
      msg.textContent = 'Copied to your clipboard — tap the MLS search field below, then Paste.';
    }
    if(copyBtn){
      copyBtn.addEventListener('click', function(){ copyText(term, msg); });
    }
    input.addEventListener('focus', function(){ input.select(); });
  };

  window.sgInitMlsFrame = function(){
    var url = window.SG_MLS_EMBED || 'https://link.flexmls.com/1zc76kndtgku,15';
    var frame = document.getElementById('mlsFrame');
    var tab = document.getElementById('mlsOpenTab');
    if(frame && !frame.src) frame.src = url;
    if(tab){
      tab.href = url;
      tab.rel = 'noopener noreferrer';
      tab.target = '_blank';
    }
    if(typeof window.sgInitMlsCarry === 'function') window.sgInitMlsCarry();
  };
})();
