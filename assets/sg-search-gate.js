// Concierge Search gate — DISABLED (ungated for now).
// Future: Cloudflare Access + Google, or Google Identity + Pages Function.
// Not Netlify Identity (site leaving Netlify). Re-enable via search.html when ready.
(function(){
  'use strict';

  var gateEl = document.getElementById('sgSearchGate');
  var contentEl = document.getElementById('sgSearchContent');
  if(!gateEl || !contentEl) return;

  function unlockSearch(user){
    gateEl.hidden = true;
    contentEl.hidden = false;
    if(typeof window.sgInitMlsFrame === 'function') window.sgInitMlsFrame();
    if(user) recordConciergeAccess(user);
  }

  function recordConciergeAccess(user){
    if(!user || !user.email) return;
    var key = 'sg_concierge_logged_' + user.email;
    if(sessionStorage.getItem(key)) return;
    sessionStorage.setItem(key, '1');
    var body = new FormData();
    body.append('form-name', 'concierge-access');
    body.append('email', user.email);
    body.append('name', (user.user_metadata && user.user_metadata.full_name) || user.email);
    body.append('source', 'concierge-search-gate');
    fetch('/', { method: 'POST', body: body }).catch(function(){});
  }

  function bindButtons(){
    var loginBtn = document.getElementById('sgGateLogin');
    var signupBtn = document.getElementById('sgGateSignup');
    if(loginBtn){
      loginBtn.addEventListener('click', function(){
        if(window.netlifyIdentity) window.netlifyIdentity.open('login');
      });
    }
    if(signupBtn){
      signupBtn.addEventListener('click', function(){
        if(window.netlifyIdentity) window.netlifyIdentity.open('signup');
      });
    }
  }

  function initIdentity(){
    if(!window.netlifyIdentity){
      showIdentityUnavailable();
      return;
    }
    bindButtons();
    window.netlifyIdentity.on('init', function(user){
      if(user) unlockSearch(user);
    });
    window.netlifyIdentity.on('login', function(user){
      window.netlifyIdentity.close();
      unlockSearch(user);
    });
    window.netlifyIdentity.on('logout', function(){
      gateEl.hidden = false;
      contentEl.hidden = true;
      var frame = document.getElementById('mlsFrame');
      if(frame) frame.removeAttribute('src');
    });
  }

  function showIdentityUnavailable(){
    var note = document.getElementById('sgGateNote');
    if(note){
      note.textContent = 'Sign-in is available on the live site. Deploy to Netlify and enable Identity with Google in your Netlify dashboard.';
    }
  }

  if(window.netlifyIdentity){
    initIdentity();
  } else {
    window.addEventListener('load', initIdentity);
  }
})();
