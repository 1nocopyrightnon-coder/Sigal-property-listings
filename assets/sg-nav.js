// ═══════════════════════════════════════════════════════════════
// SIGAL GROUP REALTY — UNIFIED NAVIGATION SCRIPT
// Injects nav at top of body on every page, identical behavior
// ═══════════════════════════════════════════════════════════════
(function(){
  'use strict';

  var LOGO = 'https://static.wixstatic.com/media/640c0f_09000c1816174075966619a837ef40c3~mv2.png/v1/crop/x_0,y_63,w_500,h_231/fill/w_240,h_101,al_c,q_85,usm_0.66_1.00_0.01,enc_avif,quality_auto/Real%20Estate%20Logo_edited.png';

  // Resolve links from the site root even when the page is /blog/... or /admin/...
  function href(file){
    file = String(file || '').replace(/^\//, '');
    var path = window.location.pathname || '/';
    var cut = path.search(/\/(blog|admin)(\/|$)/i);
    if (cut !== -1) return path.slice(0, cut + 1) + file;
    return '/' + file;
  }

  var ITEMS = [
    { num:'01', href:'index.html',         label:'Home',        italic:''           },
    { num:'02', href:'properties.html',    label:'Properties',  italic:''           },
    { num:'03', href:'search.html',        label:'Concierge ',  italic:'Search'     },
    { num:'04', href:'sell.html',          label:'Sell ',       italic:'Your Home'  },
    { num:'05', href:'neighborhoods.html', label:'Top ',        italic:'Areas'      },
    { num:'06', href:'blog/index.html',    label:'Blog',        italic:'',
      children:[
        { href:'blog/boca-raton.html',      label:'Boca Raton' },
        { href:'blog/delray-beach.html',    label:'Delray Beach' },
        { href:'blog/highland-beach.html',  label:'Highland Beach' },
        { href:'blog/parkland.html',    label:'Parkland' },
        { href:'blog/deerfield-beach.html', label:'Deerfield Beach' },
        { href:'blog/boynton-beach.html',   label:'Boynton Beach' }
      ]
    },
    { num:'07', href:'about.html',         label:'About ',      italic:'Sigal'      },
    { num:'08', href:'contact.html',       label:'Contact',     italic:''           }
  ];

  function build(){
    if(document.querySelector('.sg-nav')) return; // already built

    // Determine if this is the homepage (transparent-over-hero treatment)
    var path = window.location.pathname.replace(/\/$/,'');
    var inSub = /\/blog(\/|$)/.test(path) || /\/admin(\/|$)/.test(path);
    var isHome = !inSub && (path === '' || path === '/index.html' || path.endsWith('/index.html') || path.endsWith('/'));
    if(isHome) document.body.setAttribute('data-hero','true');
    document.body.classList.add('sg-pad');

    // ── Top bar ──────────────────────────────────────
    var nav = document.createElement('nav');
    nav.className = 'sg-nav';

    var logoLink = document.createElement('a');
    logoLink.href = href('index.html');
    logoLink.className = 'sg-nav-logo';
    logoLink.setAttribute('aria-label','Sigal Group Realty home');
    var logoImg = document.createElement('img');
    logoImg.src = LOGO;
    logoImg.alt = 'Sigal Group Realty';
    logoLink.appendChild(logoImg);
    nav.appendChild(logoLink);

    // Desktop menu
    var ul = document.createElement('ul');
    ul.className = 'sg-nav-menu';
    ITEMS.forEach(function(item){
      var li = document.createElement('li');
      if(item.children && item.children.length){
        li.className = 'sg-nav-dd';
      }
      var a = document.createElement('a');
      a.href = href(item.href);
      if(item.label === 'Contact'){
        a.className = 'sg-nav-cta';
        a.textContent = 'Free Consultation';
        a.href = href('contact.html');
      } else {
        a.textContent = item.label.trim() + (item.italic ? ' ' + item.italic : '');
      }
      li.appendChild(a);
      if(item.children && item.children.length){
        var panel = document.createElement('div');
        panel.className = 'sg-nav-dd-panel';
        item.children.forEach(function(child){
          var ca = document.createElement('a');
          ca.href = href(child.href);
          ca.textContent = child.label;
          panel.appendChild(ca);
        });
        li.appendChild(panel);
      }
      ul.appendChild(li);
    });
    nav.appendChild(ul);

    // Hamburger toggle
    var toggle = document.createElement('button');
    toggle.className = 'sg-nav-toggle';
    toggle.id = 'sgNavToggle';
    toggle.setAttribute('aria-label','Open menu');
    toggle.setAttribute('aria-expanded','false');
    for(var s=0;s<3;s++){
      toggle.appendChild(document.createElement('span'));
    }
    toggle.addEventListener('click', toggleMenu);
    nav.appendChild(toggle);

    document.body.insertBefore(nav, document.body.firstChild);

    // ── Mobile menu overlay ──────────────────────────
    var mobmenu = document.createElement('div');
    mobmenu.className = 'sg-mobmenu';
    mobmenu.id = 'sgMobMenu';
    mobmenu.setAttribute('aria-hidden','true');

    var eyebrow = document.createElement('div');
    eyebrow.className = 'sg-mob-eyebrow';
    eyebrow.textContent = 'Navigate';
    mobmenu.appendChild(eyebrow);

    var mobUl = document.createElement('ul');
    mobUl.className = 'sg-mob-list';
    ITEMS.forEach(function(item){
      var li = document.createElement('li');
      var a = document.createElement('a');
      a.href = href(item.href);
      a.addEventListener('click', closeMenu);

      var num = document.createElement('span');
      num.className = 'sg-mob-num';
      num.textContent = item.num;
      a.appendChild(num);

      var label = document.createElement('span');
      label.className = 'sg-mob-label';
      if(item.italic){
        label.appendChild(document.createTextNode(item.label));
        var i = document.createElement('i');
        i.textContent = item.italic;
        label.appendChild(i);
      } else {
        label.textContent = item.label;
      }
      a.appendChild(label);

      var arrow = document.createElement('span');
      arrow.className = 'sg-mob-arrow';
      arrow.textContent = '→';
      a.appendChild(arrow);

      li.appendChild(a);
      if(item.children && item.children.length){
        var sub = document.createElement('div');
        sub.className = 'sg-mob-sub';
        item.children.forEach(function(child){
          var ca = document.createElement('a');
          ca.href = href(child.href);
          ca.textContent = child.label;
          ca.addEventListener('click', closeMenu);
          sub.appendChild(ca);
        });
        li.appendChild(sub);
      }
      mobUl.appendChild(li);
    });
    mobmenu.appendChild(mobUl);

    var footer = document.createElement('div');
    footer.className = 'sg-mob-footer';

    var contactLabel = document.createElement('div');
    contactLabel.className = 'sg-mob-footer-label';
    contactLabel.textContent = 'Get in Touch';
    footer.appendChild(contactLabel);

    var contactDiv = document.createElement('div');
    contactDiv.className = 'sg-mob-contact';

    var phone = document.createElement('a');
    phone.href = 'tel:6177770485';
    phone.textContent = '(617) 777-0485';
    contactDiv.appendChild(phone);

    var email = document.createElement('a');
    email.href = 'mailto:info@sigalgrouprealty.com';
    email.textContent = 'info@sigalgrouprealty.com';
    contactDiv.appendChild(email);

    footer.appendChild(contactDiv);
    mobmenu.appendChild(footer);

    document.body.appendChild(mobmenu);

    // ── Scroll handler — adds 'scrolled' class ───────
    var lastScroll = 0;
    window.addEventListener('scroll', function(){
      var y = window.scrollY;
      if(y > 40) nav.classList.add('scrolled');
      else nav.classList.remove('scrolled');
    }, { passive:true });

    // Initial state
    if(window.scrollY > 40) nav.classList.add('scrolled');

    // Close menu on Escape
    document.addEventListener('keydown', function(e){
      if(e.key === 'Escape' && mobmenu.classList.contains('is-open')){
        closeMenu();
      }
    });
  }

  function toggleMenu(){
    var menu = document.querySelector('.sg-mobmenu');
    var btn = document.querySelector('.sg-nav-toggle');
    if(!menu || !btn) return;
    var isOpen = menu.classList.toggle('is-open');
    btn.classList.toggle('is-open', isOpen);
    btn.setAttribute('aria-expanded', String(isOpen));
    btn.setAttribute('aria-label', isOpen ? 'Close menu' : 'Open menu');
    menu.setAttribute('aria-hidden', String(!isOpen));
    document.body.classList.toggle('sg-locked', isOpen);
  }

  function closeMenu(){
    var menu = document.querySelector('.sg-mobmenu');
    var btn = document.querySelector('.sg-nav-toggle');
    if(!menu) return;
    menu.classList.remove('is-open');
    if(btn){
      btn.classList.remove('is-open');
      btn.setAttribute('aria-expanded','false');
      btn.setAttribute('aria-label','Open menu');
    }
    menu.setAttribute('aria-hidden','true');
    document.body.classList.remove('sg-locked');
  }

  function addHeroCloth(){
    var n = 32;
    var heroes = document.querySelectorAll('.page-hero, .ph-hero, .about-hero, .sh-left');
    for (var h = 0; h < heroes.length; h++){
      var hero = heroes[h];
      if (hero.querySelector('.page-hero-cloth')) continue;
      var cloth = document.createElement('div');
      cloth.className = 'page-hero-cloth';
      cloth.setAttribute('aria-hidden', 'true');
      cloth.style.setProperty('--n', String(n));
      var bits = '';
      for (var i = 0; i < n; i++) bits += '<i style="--i:' + i + '"></i>';
      cloth.innerHTML = bits;
      hero.insertBefore(cloth, hero.firstChild);
    }
  }

  function init(){
    build();
    addHeroCloth();
  }

  // Build on load
  if(document.readyState === 'loading'){
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
