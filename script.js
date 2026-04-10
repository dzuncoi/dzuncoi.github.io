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
  const cmdline      = document.getElementById('cmdline');
  const cmdlineInput = document.getElementById('cmdlineInput');
  const cmdlineHint  = document.getElementById('cmdlineHint');
  const cmdlineMsg   = document.getElementById('cmdlineMsg');
  const whichKey     = document.getElementById('whichKey');
  const editorPane   = document.querySelector('.editor-pane');

  let currentTab      = 'about';
  let cmdlineTimer    = null;
  let modeTimer       = null;
  let msgTimer        = null;

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

    // Reset scroll of the editor pane when switching buffers
    if (editorPane) {
      editorPane.scrollTop = 0;
    }
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
      // Return focus to the body so vim keys work
      document.activeElement.blur();
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
      e.preventDefault();
      scrollActiveBuffer(80);
      return;
    }

    // k: scroll up
    if (key === 'k') {
      e.preventDefault();
      scrollActiveBuffer(-80);
      return;
    }

    // :: focus command line
    if (key === ':') {
      e.preventDefault();
      openCmdline();
      return;
    }
  });

  // ========================================
  // SCROLL HELPERS
  // ========================================
  function scrollActiveBuffer(amount) {
    if (editorPane) {
      editorPane.scrollBy({ top: amount, behavior: 'smooth' });
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
    statusMode.classList.remove('insert', 'normal', 'command');

    if (mode === 'INSERT') {
      statusMode.classList.add('insert');
    } else if (mode === 'COMMAND') {
      statusMode.classList.add('command');
    } else {
      statusMode.classList.add('normal');
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
  // 5. COMMAND LINE — INTERACTIVE
  // ========================================

  // --- File name resolution map ---
  const FILE_TO_TAB = {};
  for (const [tab, info] of Object.entries(TAB_MAP)) {
    FILE_TO_TAB[info.file] = tab;                         // about.lua -> about
    FILE_TO_TAB[info.file.replace(/\.[^.]+$/, '')] = tab; // about -> about
    FILE_TO_TAB[tab] = tab;                                // about -> about
  }

  // --- Command definitions ---
  const COMMANDS = {
    'e':      { desc: 'edit/open a buffer',  run: cmdEdit },
    'edit':   { desc: 'edit/open a buffer',  run: cmdEdit },
    'bn':     { desc: 'next buffer',         run: cmdBufNext },
    'bnext':  { desc: 'next buffer',         run: cmdBufNext },
    'bp':     { desc: 'previous buffer',     run: cmdBufPrev },
    'bprev':  { desc: 'previous buffer',     run: cmdBufPrev },
    'ls':     { desc: 'list buffers',        run: cmdLs },
    'buffers':{ desc: 'list buffers',        run: cmdLs },
    'help':   { desc: 'show keybindings',    run: cmdHelp },
    'h':      { desc: 'show keybindings',    run: cmdHelp },
    'q':      { desc: 'quit',               run: cmdQuit },
    'quit':   { desc: 'quit',               run: cmdQuit },
    'q!':     { desc: 'force quit',          run: cmdQuit },
    'wq':     { desc: 'write and quit',      run: cmdQuit },
  };

  function cmdEdit(args) {
    const filename = (args[0] || '').trim();
    if (!filename) {
      showMsg('Usage: :e <filename>  (try :ls to list files)', true);
      return;
    }
    const tab = FILE_TO_TAB[filename];
    if (tab) {
      switchTab(tab);
      showMsg(`"${TAB_MAP[tab].file}" opened`);
    } else {
      showMsg(`E484: Can\'t open file: ${filename}`, true);
    }
  }

  function cmdBufNext() {
    const idx = TAB_KEYS.indexOf(currentTab);
    const next = TAB_KEYS[(idx + 1) % TAB_KEYS.length];
    switchTab(next);
    showMsg(`buffer ${TAB_KEYS.indexOf(next) + 1}: ${TAB_MAP[next].file}`);
  }

  function cmdBufPrev() {
    const idx = TAB_KEYS.indexOf(currentTab);
    const prev = TAB_KEYS[(idx - 1 + TAB_KEYS.length) % TAB_KEYS.length];
    switchTab(prev);
    showMsg(`buffer ${TAB_KEYS.indexOf(prev) + 1}: ${TAB_MAP[prev].file}`);
  }

  function cmdLs() {
    const list = TAB_KEYS.map((t, i) => {
      const marker = t === currentTab ? '%a' : '  ';
      return `${i + 1} ${marker} "${TAB_MAP[t].file}"`;
    }).join('  |  ');
    showMsg(list);
  }

  function cmdHelp() {
    closeCmdline();
    toggleWhichKey();
  }

  function cmdQuit() {
    showMsg('E37: No write since last change — just kidding!');
    // Easter egg: redirect to a rickroll after a pause
    setTimeout(() => {
      window.open('https://www.youtube.com/watch?v=dQw4w9WgXcQ', '_blank');
    }, 800);
  }

  // --- Open / close / execute ---
  function openCmdline() {
    if (cmdlineTimer) { clearTimeout(cmdlineTimer); cmdlineTimer = null; }
    cmdline.classList.add('active');
    cmdlineInput.value = '';
    cmdlineHint.textContent = 'type a command and press Enter';
    cmdlineInput.focus();
    setMode('COMMAND');
  }

  function closeCmdline() {
    cmdline.classList.remove('active');
    cmdlineInput.value = '';
    cmdlineHint.textContent = '';
    if (cmdlineTimer) { clearTimeout(cmdlineTimer); cmdlineTimer = null; }
  }

  function executeCommand(raw) {
    const parts = raw.trim().split(/\s+/);
    const cmd   = parts[0];
    const args  = parts.slice(1);

    if (!cmd) return;

    const handler = COMMANDS[cmd];
    if (handler) {
      handler.run(args);
    } else {
      showMsg(`E492: Not an editor command: ${cmd}`, true);
    }
  }

  // --- Animated cmdline (used on tab switch, non-interactive) ---
  function animateCmdline(text) {
    if (cmdlineTimer) { clearTimeout(cmdlineTimer); cmdlineTimer = null; }
    cmdline.classList.add('active');
    cmdlineInput.value = '';
    cmdlineInput.disabled = true;
    cmdlineHint.textContent = '';

    let i = 0;
    function typeChar() {
      if (i < text.length) {
        cmdlineInput.value = text.slice(0, i + 1);
        i++;
        cmdlineTimer = setTimeout(typeChar, 40 + Math.random() * 30);
      } else {
        cmdlineTimer = setTimeout(() => {
          closeCmdline();
          cmdlineInput.disabled = false;
        }, 600);
      }
    }
    typeChar();
  }

  // --- Message bar ---
  function showMsg(text, isError) {
    if (msgTimer) { clearTimeout(msgTimer); }
    cmdlineMsg.textContent = text;
    cmdlineMsg.classList.toggle('error', !!isError);
    cmdlineMsg.classList.add('visible');
    msgTimer = setTimeout(() => {
      cmdlineMsg.classList.remove('visible', 'error');
    }, 4000);
  }

  // --- Input event handlers ---
  cmdlineInput.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      const val = cmdlineInput.value;
      closeCmdline();
      setMode('NORMAL');
      document.activeElement.blur();
      executeCommand(val);
    }
    if (e.key === 'Escape') {
      e.preventDefault();
      closeCmdline();
      setMode('NORMAL');
      document.activeElement.blur();
    }
    // Allow Tab completion for :e
    if (e.key === 'Tab') {
      e.preventDefault();
      const val = cmdlineInput.value.trim();
      if (val.startsWith('e ')) {
        const partial = val.slice(2).trim().toLowerCase();
        const allFiles = TAB_KEYS.map(t => TAB_MAP[t].file);
        const match = allFiles.find(f => f.toLowerCase().startsWith(partial));
        if (match) {
          cmdlineInput.value = `e ${match}`;
        }
      }
    }
  });

  // Live hint as user types
  cmdlineInput.addEventListener('input', () => {
    const val = cmdlineInput.value.trim();
    const parts = val.split(/\s+/);
    const cmd = parts[0];

    if (!cmd) {
      cmdlineHint.textContent = 'type a command and press Enter';
      return;
    }

    const handler = COMMANDS[cmd];
    if (handler) {
      cmdlineHint.textContent = handler.desc;
    } else {
      // Partial match hint
      const matches = Object.keys(COMMANDS).filter(c => c.startsWith(cmd));
      if (matches.length === 1) {
        cmdlineHint.textContent = COMMANDS[matches[0]].desc;
      } else if (matches.length > 1) {
        cmdlineHint.textContent = matches.join(', ');
      } else {
        cmdlineHint.textContent = '';
      }
    }
  });

  // ========================================
  // 6. SCROLL POSITION TRACKING
  // ========================================
  function updateScrollPosition() {
    if (!editorPane) return;

    const scrollTop    = editorPane.scrollTop;
    const scrollHeight = editorPane.scrollHeight;
    const clientHeight = editorPane.clientHeight;

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

  // Attach scroll listener to the editor pane (the actual scrollable container)
  if (editorPane) {
    editorPane.addEventListener('scroll', updateScrollPosition);
  }

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
      // Returning visitor in this session — remove toast immediately
      welcomeToast.remove();
    } else {
      sessionStorage.setItem('nvim-portfolio-visited', '1');

      // Auto-dismiss after 8 seconds
      const autoDismiss = setTimeout(() => {
        dismissToast();
      }, 9500); // 1.5s delay for animation + 8s visible

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

      // Also dismiss when user presses ? (they found the help)
      document.addEventListener('keydown', function dismissOnHelp(e) {
        if (e.key === '?') {
          dismissToast();
          document.removeEventListener('keydown', dismissOnHelp);
        }
      });
    }
  }

});
