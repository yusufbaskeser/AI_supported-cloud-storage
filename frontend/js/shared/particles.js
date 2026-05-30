const SynapseParticles = (() => {

  const AUTH_COLORS  = { light: '#ffffff', dark: '#93c5fd' };
  const HERO_COLORS  = { light: '#2563eb', dark: '#3b82f6' };

  function currentTheme() {
    return document.documentElement.getAttribute('data-theme') || 'light';
  }

  function authConfig(theme) {
    const color = AUTH_COLORS[theme];
    return {
      fullScreen: { enable: false },
      background: { color: { value: 'transparent' } },
      fpsLimit: 60,
      particles: {
        number:  { value: 65, density: { enable: true, area: 900 } },
        color:   { value: color },
        links: {
          enable:   true,
          distance: 155,
          color:    color,
          opacity:  0.28,
          width:    0.85,
        },
        move: {
          enable:    true,
          speed:     0.5,
          direction: 'none',
          random:    true,
          outModes:  { default: 'bounce' },
        },
        opacity: {
          value: 0.65,
          animation: { enable: true, speed: 0.7, minimumValue: 0.25, sync: false },
        },
        size: { value: { min: 1.5, max: 3.5 } },
        shape: { type: 'circle' },
      },
      interactivity: {
        detectsOn: 'canvas',
        events: {
          onHover: { enable: true, mode: 'grab' },
          onClick:  { enable: true, mode: 'push' },
        },
        modes: {
          grab: { distance: 145, links: { opacity: 0.6 } },
          push: { quantity: 3, limit: 5 },
        },
      },
      detectRetina: true,
    };
  }

  function heroConfig(theme) {
    const color = HERO_COLORS[theme];
    return {
      fullScreen: { enable: false },
      background: { color: { value: 'transparent' } },
      fpsLimit: 60,
      particles: {
        number:  { value: 70, density: { enable: true, area: 900 } },
        color:   { value: color },
        links: {
          enable:   true,
          distance: 145,
          color:    color,
          opacity:  0.25,
          width:    0.8,
        },
        move: {
          enable:    true,
          speed:     0.5,
          direction: 'none',
          random:    true,
          outModes:  { default: 'bounce' },
        },
        opacity: {
          value: 0.45,
          animation: { enable: true, speed: 0.6, minimumValue: 0.12, sync: false },
        },
        size: { value: { min: 1.2, max: 3 } },
        shape: { type: 'circle' },
      },
      interactivity: {
        detectsOn: 'window',
        events: {
          onHover: { enable: true, mode: 'grab' },
          onClick:  { enable: true, mode: 'push' },
        },
        modes: {
          grab: { distance: 160, links: { opacity: 0.55 } },
          push: { quantity: 2, limit: 4 },
        },
      },
      detectRetina: true,
    };
  }

  async function _load(id, config) {
    await tsParticles.load(id, config);
  }

  return {
    async initAuth(id) {
      const theme = currentTheme();
      await _load(id, authConfig(theme));
    },

    async initHero(id) {
      const theme = currentTheme();
      await _load(id, heroConfig(theme));
    },

    async onThemeChange(theme) {
      const containers = tsParticles.dom();
      for (const c of containers) {
        try {
          const isAuth  = c.id === 'auth-particles';
          const color   = isAuth ? AUTH_COLORS[theme] : HERO_COLORS[theme];
          const wrapper = document.getElementById(c.id);

          if (wrapper) {
            wrapper.style.transition = 'opacity 0.15s ease';
            wrapper.style.opacity    = '0';
          }

          await new Promise(r => setTimeout(r, 160));

          c.options.particles.color.value = color;
          if (c.options.particles.links) {
            c.options.particles.links.color = color;
          }
          await c.refresh();

          if (wrapper) {
            wrapper.style.transition = 'opacity 0.35s ease';
            requestAnimationFrame(() => { wrapper.style.opacity = '1'; });
          }
        } catch (_) {}
      }
    },
  };
})();
