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

    const pointer = { x: 0, y: 0, vx: 0, vy: 0, last: -Infinity };
    let hoveredStar = null;
    let markers = Array.from(stars.children);
    const pulses = [];
    function resetMarkers() {
        markers = Array.from(stars.children);
        hoveredStar = null;
    }
    document.addEventListener('eqai:cards-rendered', resetMarkers);
    stars.addEventListener('pointerover', event => { hoveredStar = event.target.closest('.constellation-star'); });
    stars.addEventListener('pointerout', event => {
        hoveredStar = event.relatedTarget?.closest?.('.constellation-star') || null;
    });
    function trackPointer(event) {
        if (motion.matches || event.target.closest('.constellation-star')) return;
        const bounds = hero.getBoundingClientRect();
        const now = performance.now();
        const x = event.clientX - bounds.left;
        const y = event.clientY - bounds.top;
        if (now - pointer.last < 120 && event.type === 'pointermove') {
            pointer.vx = Math.max(-34, Math.min(34, x - pointer.x));
            pointer.vy = Math.max(-34, Math.min(34, y - pointer.y));
        } else {
            pointer.vx = pointer.vy = 0;
        }
        pointer.x = x;
        pointer.y = y;
        pointer.last = now;
        if (event.type === 'pointerdown') {
            pulses.push({ x, y, start: now });
            if (pulses.length > 4) pulses.shift();
        }
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
        // Distribute adjacent lettering samples across the globe so paths fan out.
        for (let i = particles.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [particles[i], particles[j]] = [particles[j], particles[i]];
        }
        return { width, height, stars: generateStars(width < 480 ? 120 : 200), particles, morph: 0 };
    }

    function drawHero(ctx, scene, time, still) {
        const { width, height, particles } = scene;
        const centerX = width / 2;
        const centerY = height / 2;
        const radius = Math.min(width * .36, height * .39);
        const now = performance.now();
        const idleFor = now - pointer.last;
        const active = !still && idleFor < 1900;
        const interaction = active ? Math.max(0, 1 - idleFor / 520) : 0;
        const pointerX = pointer.x / width - .5;
        const pointerY = pointer.y / height - .5;
        scene.morph = still ? 0 : scene.morph + ((active ? 1 : 0) - scene.morph) * .15;
        const blend = scene.morph < .002 ? 0 : scene.morph;
        const rotation = time * .73 + pointerX * 1.5 * blend;
        const tilt = .25 + pointerY * 1.45 * blend;
        const cosTilt = Math.cos(tilt);
        const sinTilt = Math.sin(tilt);
        const reach = Math.min(150, width * .32);
        while (pulses.length && now - pulses[0].start > 1000) pulses.shift();
        const wavefronts = still ? [] : pulses.map(pulse => ({ ...pulse, progress: (now - pulse.start) / 1000 }));
        moveMarkers(still ? 0 : time, still, interaction, pointerX, pointerY);
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
            const z = ring * Math.sin(longitude);
            const depth = latitude * sinTilt + z * cosTilt;
            const perspective = 1 + depth * .24;
            const breath = radius * (1 + .032 * Math.sin(time * 2.8 + i * .28));
            const globeX = centerX + (ring * Math.cos(longitude) * breath * perspective) + pointerX * width * .06;
            const globeY = centerY + ((latitude * cosTilt - z * sinTilt) * breath * perspective) + pointerY * height * .12;
            let x = p.x + (globeX - p.x) * blend;
            let y = p.y + (globeY - p.y) * blend;
            const dx = x - pointer.x;
            const dy = y - pointer.y;
            const force = Math.max(0, 1 - Math.hypot(dx, dy) / reach) * interaction * 1.25;
            x += (dx - pointer.vy * .78) * force;
            y += (dy + pointer.vx * .78) * force;
            for (const wave of wavefronts) {
                const wx = x - wave.x;
                const wy = y - wave.y;
                const distance = Math.hypot(wx, wy);
                const push = Math.max(0, 1 - Math.abs(distance - wave.progress * radius * 3.3) / 37)
                    * (1 - wave.progress) * .55;
                x += wx * push;
                y += wy * push;
            }
            const size = (.65 + p.seed * .82) * Math.max(1, width / 650) * (1 + blend * depth * .28);
            ctx.fillStyle = p.seed > .93 ? '#ffe0a9' : p.seed > .35 ? '#bbecff' : '#78aaff';
            ctx.globalAlpha = (.77 + p.seed * .23) * (1 - blend * (1 - depth) * .31);
            ctx.beginPath();
            ctx.arc(x, y, size, 0, TAU);
            ctx.fill();
        }
        ctx.globalAlpha = 1;
        for (const wave of wavefronts) {
            ctx.beginPath();
            ctx.strokeStyle = 'rgba(166,229,255,' + ((1 - wave.progress) * .47) + ')';
            ctx.arc(wave.x, wave.y, 5 + wave.progress * radius * 3.3, 0, TAU);
            ctx.stroke();
        }
        if (particles.length) hero.classList.add('has-particles');
    }

    function moveMarkers(time, still, interaction, x, y) {
        const focused = document.activeElement;
        markers.forEach((star, index) => {
            // Hold the current hit target while it is hovered, pressed or focused.
            if (!still && (star === hoveredStar || star === focused)) return;
            const phase = index * .92;
            const dx = Math.sin(time * .92 + phase) * 8 + Math.sin(time * .47 + phase) * 5 + x * interaction * 9;
            const dy = Math.cos(time * 1.13 + phase) * 8 + y * interaction * 10;
            star.style.setProperty('--star-x', (still ? 0 : dx).toFixed(1) + 'px');
            star.style.setProperty('--star-y', (still ? 0 : dy).toFixed(1) + 'px');
            star.style.setProperty('--star-turn', (still ? 0 : Math.sin(time + phase) * 19).toFixed(1) + 'deg');
            star.style.setProperty('--star-light', (still ? .48 : .48 + Math.sin(time * 2.2 + phase) * .33).toFixed(2));
        });
    }

    function observeTitles() {
        let observer;
        let revision = 0;
        const glyphs = '◇⟐⌁⟁⋔⟡⊹⟢⌬∴⧖';
        function wrapText(root) {
            // Leave the original text and surrounding icons in the accessibility tree.
            const textNodes = Array.from(root.childNodes).filter(node =>
                node.nodeType === Node.TEXT_NODE && node.textContent.trim()
            );
            for (const node of textNodes) {
                const wrapper = document.createElement('span');
                wrapper.className = 'reveal-text';
                const original = document.createElement('span');
                original.className = 'reveal-original';
                const overlay = document.createElement('span');
                overlay.className = 'title-reveal';
                overlay.setAttribute('aria-hidden', 'true');
                node.replaceWith(wrapper);
                original.append(node);
                wrapper.append(original, overlay);
            }
        }

        function reveal(overlay) {
            const title = Array.from(overlay.previousElementSibling.textContent);
            const start = performance.now();
            const currentRevision = revision;
            let lastStep = -1;
            function update(now) {
                if (currentRevision !== revision) return;
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
            revision++;
            observer?.disconnect();
            document.querySelectorAll('.title-reveal[data-glyphs]').forEach(el => el.removeAttribute('data-glyphs'));
            if (motion.matches) return;
            const current = new IntersectionObserver(entries => {
                for (const entry of entries) {
                    if (!entry.isIntersecting || entry.intersectionRatio < .5) continue;
                    current.unobserve(entry.target);
                    const overlay = Array.from(entry.target.querySelectorAll('.title-reveal')).find(el => el.parentElement.getClientRects().length);
                    if (overlay) reveal(overlay);
                }
            }, { threshold: .5 });
            observer = current;
            for (const heading of document.querySelectorAll('[data-title-reveal]')) {
                const translations = Array.from(heading.children).filter(el =>
                    el.matches('.i18n-block-ko, .i18n-block-en, .i18n-block-ja')
                );
                const root = translations.find(el => getComputedStyle(el).display !== 'none') || heading;
                wrapText(root);
                current.observe(heading);
            }
        }
        try { observe(); } catch { return; }
        document.addEventListener('eqai:cards-rendered', observe);
        motion.addEventListener('change', observe);
    }

    observeTitles();
    mountScene(document.getElementById('heroParticles'), prepareHero, drawHero);
})();
