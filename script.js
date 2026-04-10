/* ============================================================
   NEOVIM PORTFOLIO — INTERACTIONS
   Tab switching, keyboard shortcuts, mode indicator,
   command line animation, scroll tracking
   ============================================================ */

document.addEventListener('DOMContentLoaded', () => {

  // ========================================
  // TAB / FILE MAPPING
  // ========================================
  const TAB_MAP = {
    about:      { file: 'about.lua',      ft: 'lua'  },
    experience: { file: 'experience.log',  ft: 'log'  },
    projects:   { file: 'projects.json',   ft: 'json' },
    skills:     { file: 'skills.yaml',     ft: 'yaml' },
    contact:    { file: 'contact.sh',      ft: 'sh'   },
  };

  const TAB_KEYS = ['about', 'experience', 'projects', 'skills', 'contact'];

  // ========================================
  // DOM REFS
  // ========================================
  const tabs        = document.querySelectorAll('.tab');
  const treeFiles   = document.querySelectorAll('.tree-file');
  const buffers     = document.querySelectorAll('.buffer');
  const sidebar     = document.getElementById('sidebar');
  const sidebarBtn  = document.getElementById('sidebarToggle');
  const statusMode  = document.getElementById('statusMode');
  const statusFile  = document.getElementById('statusFile');
  const statusFt    = document.getElementById('statusFt');
  const statusPos   = document.getElementById('statusPos');
  const statusPct   = document.querySelector('.status-pct');
  const cmdline     = document.getElementById('cmdline');
  const cmdlineText = document.getElementById('cmdlineText');
  const whichKey     = document.getElementById('whichKey');
  const editorPane   = document.querySelector('.editor-pane');

  let currentTab      = 'about';
  let cmdlineTimer    = null;
  let modeTimer       = null;
  let cmdlineAnimId   = 0;

  // ========================================
  // 1. TAB SWITCHING
  // ========================================
  function switchTab(tabName) {
    if (!TAB_MAP[tabName]) return;
    currentTab = tabName;
    const info = TAB_MAP[tabName];

    // Update tab bar
    tabs.forEach(t => {
      t.classList.toggle('active', t.getAttribute('data-tab') === tabName);
    });

    // Update tree sidebar
    treeFiles.forEach(f => {
      f.classList.toggle('active', f.getAttribute('data-tab') === tabName);
    });

    // Update buffers
    buffers.forEach(b => {
      b.classList.toggle('active', b.id === `buf-${tabName}`);
    });

    // Update statusline
    statusFile.textContent = info.file;
    statusFt.textContent   = info.ft;
    statusPos.textContent  = 'Ln 1, Col 1';

    // Reset scroll of the newly-visible buffer
    document.getElementById(`buf-${tabName}`).scrollTop = 0;
    updateScrollPosition();

    // Command line animation
    animateCmdline(`:e ${info.file}`);
  }

  // Attach click handlers on tabs
  tabs.forEach(tab => {
    tab.addEventListener('click', () => {
      switchTab(tab.getAttribute('data-tab'));
    });
  });

  // Attach click handlers on tree files
  treeFiles.forEach(file => {
    file.addEventListener('click', () => {
      switchTab(file.getAttribute('data-tab'));
    });
  });

  // ========================================
  // 2. SIDEBAR TOGGLE
  // ========================================
  if (sidebarBtn) {
    sidebarBtn.addEventListener('click', () => {
      sidebar.classList.toggle('collapsed');
    });
  }

  // ========================================
  // 3. KEYBOARD SHORTCUTS
  // ========================================
  document.addEventListener('keydown', (e) => {
    // Don't capture keys if user is in an input/textarea
    const tag = e.target.tagName.toLowerCase();
    if (tag === 'input' || tag === 'textarea') return;

    const key = e.key;

    // Escape — close which-key, close cmdline, return to NORMAL
    if (key === 'Escape') {
      closeWhichKey();
      closeCmdline();
      setMode('NORMAL');
      return;
    }

    // 1-5: switch tabs
    if (key >= '1' && key <= '5') {
      const idx = parseInt(key, 10) - 1;
      if (TAB_KEYS[idx]) {
        switchTab(TAB_KEYS[idx]);
      }
      return;
    }

    // e: toggle sidebar
    if (key === 'e') {
      sidebar.classList.toggle('collapsed');
      return;
    }

    // ?: toggle which-key
    if (key === '?') {
      toggleWhichKey();
      return;
    }

    // j: scroll down
    if (key === 'j') {
      scrollActiveBuffer(80);
      return;
    }

    // k: scroll up
    if (key === 'k') {
      scrollActiveBuffer(-80);
      return;
    }

    // :: show command line
    if (key === ':') {
      e.preventDefault();
      showCmdline();
      return;
    }
  });

  // ========================================
  // SCROLL HELPERS
  // ========================================
  function scrollActiveBuffer(amount) {
    const active = document.querySelector('.buffer.active');
    if (active) {
      active.scrollBy({ top: amount, behavior: 'smooth' });
    }
  }

  // ========================================
  // WHICH-KEY POPUP
  // ========================================
  function toggleWhichKey() {
    whichKey.classList.toggle('active');
  }

  function closeWhichKey() {
    whichKey.classList.remove('active');
  }

  // ========================================
  // 4. MODE INDICATOR
  // ========================================
  function setMode(mode) {
    if (modeTimer) {
      clearTimeout(modeTimer);
      modeTimer = null;
    }

    statusMode.textContent = mode;
    statusMode.classList.remove('mode-insert', 'mode-normal');

    if (mode === 'INSERT') {
      statusMode.classList.add('mode-insert');
    } else {
      statusMode.classList.add('mode-normal');
    }
  }

  // Click inside editor pane -> INSERT mode briefly
  if (editorPane) {
    editorPane.addEventListener('click', () => {
      setMode('INSERT');
      modeTimer = setTimeout(() => {
        setMode('NORMAL');
      }, 2000);
    });
  }

  // ========================================
  // 5. COMMAND LINE — FAKE (animated)
  // ========================================
  function animateCmdline(text) {
    cmdlineAnimId++;
    const thisAnimId = cmdlineAnimId;
    if (cmdlineTimer) { clearTimeout(cmdlineTimer); cmdlineTimer = null; }
    cmdline.classList.add('active');
    cmdlineText.textContent = '';
    let i = 0;
    function typeChar() {
      if (thisAnimId !== cmdlineAnimId) return;
      if (i < text.length) {
        cmdlineText.textContent = text.slice(0, i + 1);
        i++;
        setTimeout(typeChar, 40 + Math.random() * 30);
      } else {
        cmdlineTimer = setTimeout(() => {
          if (thisAnimId !== cmdlineAnimId) return;
          closeCmdline();
        }, 800);
      }
    }
    typeChar();
  }

  function showCmdline() {
    cmdlineAnimId++;
    if (cmdlineTimer) { clearTimeout(cmdlineTimer); cmdlineTimer = null; }
    cmdline.classList.add('active');
    cmdlineText.textContent = '';
  }

  function closeCmdline() {
    cmdline.classList.remove('active');
    cmdlineText.textContent = '';
    if (cmdlineTimer) { clearTimeout(cmdlineTimer); cmdlineTimer = null; }
  }

  // ========================================
  // 6. SCROLL POSITION TRACKING
  // ========================================
  function updateScrollPosition() {
    const active = document.querySelector('.buffer.active');
    if (!active) return;

    const scrollTop    = active.scrollTop;
    const scrollHeight = active.scrollHeight;
    const clientHeight = active.clientHeight;

    // Approximate line number (assuming ~20px per line)
    const lineHeight = 20;
    const approxLine = Math.floor(scrollTop / lineHeight) + 1;
    const approxCol  = 1;

    statusPos.textContent = `Ln ${approxLine}, Col ${approxCol}`;

    // Percentage / Top / Bot
    if (statusPct) {
      if (scrollHeight <= clientHeight) {
        statusPct.textContent = 'All';
      } else if (scrollTop <= 0) {
        statusPct.textContent = 'Top';
      } else if (scrollTop + clientHeight >= scrollHeight - 1) {
        statusPct.textContent = 'Bot';
      } else {
        const pct = Math.round((scrollTop / (scrollHeight - clientHeight)) * 100);
        statusPct.textContent = `${pct}%`;
      }
    }
  }

  // Attach scroll listener to each buffer
  buffers.forEach(buf => {
    buf.addEventListener('scroll', updateScrollPosition);
  });

  // ========================================
  // 7. STARTUP ANIMATION
  // ========================================
  // On page load, briefly show `:e about.lua`
  setTimeout(() => {
    animateCmdline(':e about.lua');
  }, 300);

  // Initial mode
  setMode('NORMAL');

  // Initial scroll position
  updateScrollPosition();

  // ========================================
  // 8. WELCOME TOAST (first visit)
  // ========================================
  const welcomeToast = document.getElementById('welcomeToast');
  const toastClose   = document.getElementById('toastClose');

  if (welcomeToast) {
    const hasVisited = sessionStorage.getItem('nvim-portfolio-visited');

    if (hasVisited) {
      welcomeToast.remove();
    } else {
      sessionStorage.setItem('nvim-portfolio-visited', '1');

      const autoDismiss = setTimeout(() => {
        dismissToast();
      }, 9500);

      function dismissToast() {
        clearTimeout(autoDismiss);
        welcomeToast.classList.add('hidden');
        welcomeToast.addEventListener('animationend', () => {
          welcomeToast.remove();
        }, { once: true });
      }

      if (toastClose) {
        toastClose.addEventListener('click', dismissToast);
      }

      document.addEventListener('keydown', function dismissOnHelp(e) {
        if (e.key === '?') {
          dismissToast();
          document.removeEventListener('keydown', dismissOnHelp);
        }
      });
    }
  }

});
