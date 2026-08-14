// ═══════════════════════════════════════════════════════════════
// MOBILE NAV — bulletproof hamburger toggle
// Ensures the mobile menu opens VISIBLY when hamburger is tapped
// ═══════════════════════════════════════════════════════════════
(function(){
  'use strict';

  function init(){
    var toggle = document.querySelector('.sg-nav-toggle');
    var menu = document.querySelector('.sg-mobmenu');
    if(!toggle || !menu) return;

    // Make sure menu is direct child of body (avoids stacking context issues)
    if(menu.parentElement !== document.body){
      document.body.appendChild(menu);
    }

    // Force critical inline styles to override any conflicting CSS
    menu.style.position = 'fixed';
    menu.style.top = '0';
    menu.style.left = '0';
    menu.style.right = '0';
    menu.style.bottom = '0';
    menu.style.zIndex = '99999';

    // Re-bind the toggle button to be safe
    toggle.addEventListener('click', function(e){
      e.preventDefault();
      e.stopPropagation();
      var isOpen = menu.classList.contains('is-open');
      if(isOpen){
        menu.classList.remove('is-open');
        toggle.classList.remove('is-open');
        toggle.setAttribute('aria-expanded','false');
        menu.setAttribute('aria-hidden','true');
        document.body.classList.remove('sg-locked');
        document.body.style.overflow = '';
      } else {
        menu.classList.add('is-open');
        toggle.classList.add('is-open');
        toggle.setAttribute('aria-expanded','true');
        menu.setAttribute('aria-hidden','false');
        document.body.classList.add('sg-locked');
        document.body.style.overflow = 'hidden';
      }
    }, true);
  }

  // Wait for sg-nav.js to build the nav first
  function tryInit(attempt){
    if(document.querySelector('.sg-mobmenu')){
      init();
    } else if(attempt < 20){
      setTimeout(function(){ tryInit(attempt + 1); }, 100);
    }
  }

  if(document.readyState === 'loading'){
    document.addEventListener('DOMContentLoaded', function(){ tryInit(0); });
  } else {
    tryInit(0);
  }
})();
