(() => {
    const motion = matchMedia('(prefers-reduced-motion: reduce)');
    const TAU = 2 * Math.PI;

    // Each canvas keeps a static frame when hidden, offscreen or in reduced motion.
    function mountScene(canvas, prepare, draw) {
        let ctx;
        try { ctx = canvas.getContext('2d'); } catch { return; }
        if (!ctx) return;

        const host = canvas.parentElement;
        let scene;
        let frame = 0;
        let visible = true;
        let time = 0;
        let previous = 0;

        function tick(now) {
            frame = requestAnimationFrame(tick);
            if (previous && now - previous < 30) return;
            time += previous ? Math.min((now - previous) / 1000, .07) : 0;
            previous = now;
            draw(ctx, scene, time, motion.matches);
        }

        function sync() {
            cancelAnimationFrame(frame);
            previous = 0;
            if (scene && visible && !document.hidden && !motion.matches) {
                frame = requestAnimationFrame(tick);
            } else if (scene && motion.matches) {
                draw(ctx, scene, time, true);
            }
        }

        function resize() {
            const { clientWidth: width, clientHeight: height } = host;
            if (!width || !height) return;
            const dpr = Math.min(devicePixelRatio || 1, 2);
            canvas.width = Math.round(width * dpr);
            canvas.height = Math.round(height * dpr);
            ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
            scene = prepare(width, height);
            if (scene) draw(ctx, scene, time, motion.matches);
            sync();
        }

        resize();
        window.addEventListener('resize', resize);
        document.addEventListener('visibilitychange', sync);
        motion.addEventListener('change', sync);
        try {
            const observer = new IntersectionObserver(([entry]) => {
                visible = entry.isIntersecting;
                sync();
            });
            observer.observe(host);
        } catch {
            // Keep the effects available if observation is unavailable.
        }
    }

    function generateStars(count) {
        return Array.from({ length: count }, () => ({
            x: Math.random(), y: Math.random(), radius: .35 + Math.random() * 1.1, phase: Math.random() * TAU
        }));
    }

    function paintStars(ctx, { width, height, stars }, time) {
        ctx.fillStyle = '#b0d7fa';
        for (const star of stars) {
            ctx.globalAlpha = .25 + .18 * Math.sin(star.phase + time * .75);
            ctx.fillRect(star.x * width, star.y * height, star.radius, star.radius);
        }
        ctx.globalAlpha = 1;
    }

    const hero = document.getElementById('heroConstellation');
    const stars = document.getElementById('constellationStars');
    const caption = document.createElement('div');
    caption.className = 'constellation-caption';
    caption.setAttribute('aria-hidden', 'true');
    hero.append(caption);
    function showCaption(event) {
        caption.textContent = event.target.closest('.constellation-star')?.dataset.title || '';
    }
    stars.addEventListener('pointerover', showCaption);
    stars.addEventListener('pointerout', event => {
        caption.textContent = event.relatedTarget?.closest?.('.constellation-star')?.dataset.title
            || stars.querySelector(':focus-visible')?.dataset.title || '';
    });
    stars.addEventListener('focusin', showCaption);
    stars.addEventListener('focusout', () => { caption.textContent = ''; });
    document.addEventListener('eqai:cards-rendered', () => { caption.textContent = ''; });

    const pointer = { x: 0, y: 0, last: -Infinity };
    function trackPointer(event) {
        if (motion.matches || event.target.closest('.constellation-star')) return;
        const bounds = hero.getBoundingClientRect();
        pointer.x = event.clientX - bounds.left;
        pointer.y = event.clientY - bounds.top;
        pointer.last = performance.now();
    }
    hero.addEventListener('pointermove', event => {
        if (event.pointerType === 'mouse' || event.pointerType === 'pen' || event.buttons) trackPointer(event);
    });
    hero.addEventListener('pointerdown', trackPointer);

    function prepareHero(width, height) {
        const mask = document.createElement('canvas');
        mask.width = Math.round(width);
        mask.height = Math.round(height);
        const ink = mask.getContext('2d', { willReadFrequently: true });
        if (!ink) return null;

        ink.font = '900 ' + Math.min(width * .245, height * .4, 144) + 'px system-ui, sans-serif';
        ink.textAlign = 'center';
        ink.textBaseline = 'alphabetic';
        const metrics = ink.measureText('EQAI');
        const baseline = height / 2 + (metrics.actualBoundingBoxAscent - metrics.actualBoundingBoxDescent) / 2;
        ink.fillText('EQAI', width / 2, baseline);
        const pixels = ink.getImageData(0, 0, mask.width, mask.height).data;
        const spacing = Math.max(2, width / 180);
        const particles = [];
        for (let y = 0; y < mask.height; y += spacing) {
            for (let x = 0; x < mask.width; x += spacing) {
                if (pixels[(Math.floor(y) * mask.width + Math.floor(x)) * 4 + 3] < 170) continue;
                particles.push({ x, y, seed: Math.random() });
            }
        }
        return { width, height, stars: generateStars(width < 480 ? 120 : 200), particles, morph: 0 };
    }

    function drawHero(ctx, scene, time, still) {
        const { width, height, particles } = scene;
        const centerX = width / 2;
        const centerY = height / 2;
        const radius = Math.min(width * .36, height * .39);
        const active = !still && performance.now() - pointer.last < 2100;
        scene.morph = still ? 0 : scene.morph + ((active ? 1 : 0) - scene.morph) * .14;
        const blend = scene.morph < .002 ? 0 : scene.morph;
        const rotation = time * .55 + (pointer.x / width - .5) * .85;
        ctx.clearRect(0, 0, width, height);
        paintStars(ctx, scene, still ? 0 : time);

        ctx.strokeStyle = '#8bb7e145';
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.ellipse(centerX, centerY, width * .44, height * .42, 0, 0, TAU);
        ctx.stroke();
        ctx.strokeStyle = '#8bb7e122';
        ctx.beginPath();
        ctx.ellipse(centerX, centerY, width * .38, height * .36, 0, 0, TAU);
        ctx.stroke();

        const halo = ctx.createRadialGradient(centerX, centerY, 0, centerX, centerY, radius * 1.45);
        halo.addColorStop(0, '#668bd630');
        halo.addColorStop(1, '#668bd600');
        ctx.fillStyle = halo;
        ctx.fillRect(0, 0, width, height);

        for (let i = 0; i < particles.length; i++) {
            const p = particles[i];
            const latitude = 1 - (2 * i + 1) / particles.length;
            const ring = Math.sqrt(1 - latitude * latitude);
            const longitude = i * 2.399963 + rotation;
            const depth = ring * Math.sin(longitude);
            const perspective = 1 + depth * .18;
            let globeX = centerX + ring * Math.cos(longitude) * radius * perspective;
            let globeY = centerY + latitude * radius * perspective;
            if (active) {
                const dx = globeX - pointer.x;
                const dy = globeY - pointer.y;
                const force = Math.max(0, 1 - Math.hypot(dx, dy) / 86) * .38;
                globeX += dx * force;
                globeY += dy * force;
            }
            const x = p.x + (globeX - p.x) * blend;
            const y = p.y + (globeY - p.y) * blend;
            const size = (.65 + p.seed * .82) * Math.max(1, width / 650);
            ctx.fillStyle = p.seed > .93 ? '#ffe0a9' : p.seed > .35 ? '#bbecff' : '#78aaff';
            ctx.globalAlpha = (.72 + p.seed * .28) * (1 - blend * (1 - depth) * .31);
            ctx.beginPath();
            ctx.arc(x, y, size, 0, TAU);
            ctx.fill();
        }
        ctx.globalAlpha = 1;
        if (particles.length) hero.classList.add('has-particles');
    }

    function drawOrbits(ctx, scene, time, still) {
        const { width, height } = scene;
        const size = Math.min(width * .49, height * 1.08);
        const x = width / 2;
        const y = height / 2;
        const t = still ? 0 : time;
        ctx.clearRect(0, 0, width, height);
        paintStars(ctx, scene, t);

        const halo = ctx.createRadialGradient(x, y, 0, x, y, size * .52);
        halo.addColorStop(0, '#fff1c8');
        halo.addColorStop(.025, '#d3e8ff');
        halo.addColorStop(.085, '#a1d5f699');
        halo.addColorStop(.35, '#6387cf38');
        halo.addColorStop(1, '#6387cf00');
        ctx.fillStyle = halo;
        ctx.fillRect(0, 0, width, height);

        const colors = ['116,212,255', '255,211,147', '179,169,255', '140,229,219'];
        for (let i = 0; i < 6; i++) {
            const color = colors[i % colors.length];
            const rx = size * (.29 + i * .102);
            const ry = rx * (.30 + i * .023);
            const tilt = -.28 + i * .113 + Math.sin(t * .09 + i) * .07;
            const angle = t * (.51 - i * .052) + i * 1.83;
            ctx.save();
            ctx.translate(x, y);
            ctx.rotate(tilt);

            ctx.strokeStyle = 'rgba(' + color + ',.26)';
            ctx.beginPath();
            ctx.ellipse(0, 0, rx, ry, 0, 0, TAU);
            ctx.stroke();
            for (let j = 0; j < 12; j++) {
                const tail = angle - j * .035;
                ctx.strokeStyle = 'rgba(' + color + ',' + (.75 - j * .055) + ')';
                ctx.lineWidth = 1.6;
                ctx.beginPath();
                ctx.ellipse(0, 0, rx, ry, 0, tail - .036, tail);
                ctx.stroke();
            }
            const px = rx * Math.cos(angle);
            const py = ry * Math.sin(angle);
            ctx.fillStyle = '#fff2d7';
            ctx.shadowColor = 'rgb(' + color + ')';
            ctx.shadowBlur = 12;
            ctx.beginPath();
            ctx.arc(px, py, i % 2 ? 2.5 : 3.4, 0, TAU);
            ctx.fill();
            ctx.restore();
        }
        ctx.canvas.parentElement.classList.add('has-orbits');
    }

    function observeCardTitles() {
        let observer;
        const glyphs = '◇⟐⌁⟁⋔⟡⊹⟢⌬∴⧖';
        function reveal(overlay) {
            const title = Array.from(overlay.previousElementSibling.textContent);
            const start = performance.now();
            let lastStep = -1;
            function update(now) {
                const progress = (now - start) / 460;
                if (progress >= 1 || motion.matches || document.hidden || !overlay.isConnected) {
                    overlay.removeAttribute('data-glyphs');
                    return;
                }
                const step = Math.floor((now - start) / 45);
                if (step !== lastStep) {
                    const ready = Math.floor(title.length * Math.max(0, progress));
                    overlay.dataset.glyphs = title.map((letter, index) =>
                        index < ready || /\s/.test(letter) ? letter : glyphs[Math.floor(Math.random() * glyphs.length)]
                    ).join('');
                    lastStep = step;
                }
                requestAnimationFrame(update);
            }
            update(start);
        }
        function observe() {
            observer?.disconnect();
            if (motion.matches) return;
            const current = new IntersectionObserver(entries => {
                for (const entry of entries) {
                    if (!entry.isIntersecting || entry.intersectionRatio < .5) continue;
                    current.unobserve(entry.target);
                    reveal(entry.target.querySelector('.title-reveal'));
                }
            }, { threshold: .5 });
            observer = current;
            for (const heading of document.querySelectorAll('.service-body h3')) current.observe(heading);
        }
        try { observe(); } catch { return; }
        document.addEventListener('eqai:cards-rendered', observe);
    }

    observeCardTitles();
    mountScene(document.getElementById('heroParticles'), prepareHero, drawHero);
    mountScene(document.getElementById('closingOrbits'),
        (width, height) => ({ width, height, stars: generateStars(width < 480 ? 140 : 300) }), drawOrbits);
})();
