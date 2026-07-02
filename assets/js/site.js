/* Dani_MK — comportements partagés : thème, navigation, tiroir mobile */

(function(){
  if(localStorage.getItem('theme') === 'light'){
    document.documentElement.setAttribute('data-theme','light');
  }
})();

function openLink(url){
  window.open(url, '_blank', 'noopener');
}

function go(page){
  var drw = document.getElementById('drawer');
  if(drw && drw.classList.contains('open')){
    var ham = document.getElementById('hamburger');
    var ovr = document.getElementById('drawerOverlay');
    drw.classList.add('closing'); drw.classList.remove('open');
    if(ham){ ham.classList.add('closing'); ham.classList.remove('open'); }
    if(ovr){ ovr.classList.add('closing'); ovr.classList.remove('show'); }
    document.body.style.overflow = '';
    setTimeout(function(){ window.location.href = page; }, 160);
  } else {
    window.location.href = page;
  }
}

document.addEventListener('DOMContentLoaded', function(){

  /* --- Drawer mobile --- */
  var ham = document.getElementById('hamburger');
  var drw = document.getElementById('drawer');
  var ovr = document.getElementById('drawerOverlay');

  function openDrw(){
    ham.classList.remove('closing'); drw.classList.remove('closing'); ovr.classList.remove('closing');
    ham.classList.add('open'); drw.classList.add('open'); ovr.classList.add('show');
    document.body.style.overflow = 'hidden';
  }
  function closeDrw(){
    ham.classList.remove('open'); drw.classList.remove('open'); ovr.classList.remove('show');
    document.body.style.overflow = '';
  }

  if(ham && drw && ovr){
    ham.addEventListener('click', function(){ drw.classList.contains('open') ? closeDrw() : openDrw(); });
    ovr.addEventListener('click', closeDrw);
    document.addEventListener('keydown', function(e){ if(e.key === 'Escape') closeDrw(); });
  }

  /* --- Thème clair / sombre --- */
  var themeToggle = document.getElementById('themeToggle');
  var themeToggleLabel = document.getElementById('themeToggleLabel');
  var themeToggleIcon = document.getElementById('themeToggleIcon');
  var themeFab = document.getElementById('themeToggleFab');
  var themeFabIcon = document.getElementById('themeFabIcon');

  function syncThemeUI(){
    var isLight = document.documentElement.getAttribute('data-theme') === 'light';
    var icon = isLight ? '🌙' : '☀️';
    if(themeToggleIcon) themeToggleIcon.textContent = icon;
    if(themeFabIcon) themeFabIcon.textContent = icon;
    if(themeToggleLabel) themeToggleLabel.textContent = isLight ? 'Thème sombre' : 'Thème clair';
    if(themeFab) themeFab.title = isLight ? 'Activer le thème sombre' : 'Activer le thème clair';
  }

  function toggleTheme(){
    var root = document.documentElement;
    var isLight = root.getAttribute('data-theme') === 'light';
    if(isLight){ root.removeAttribute('data-theme'); localStorage.setItem('theme','dark'); }
    else{ root.setAttribute('data-theme','light'); localStorage.setItem('theme','light'); }
    syncThemeUI();
  }

  if(themeToggle) themeToggle.addEventListener('click', toggleTheme);
  if(themeFab){
    themeFab.addEventListener('click', function(){
      toggleTheme();
      themeFab.classList.remove('spin');
      void themeFab.offsetWidth;
      themeFab.classList.add('spin');
    });
    if(themeFabIcon){
      themeFabIcon.addEventListener('animationend', function(){
        themeFab.classList.remove('spin');
      });
    }
  }

  syncThemeUI();
});
