'use client';

import { useEffect } from 'react';
import { useReducedMotion } from 'motion/react';
import { contentTiming } from './SceneArt';

/** The desktop chapter already fades with scroll; never stack a second reveal. */
export default function useSceneEntrance(ref, enhanced) {
  const reduced = useReducedMotion();
  useEffect(() => {
    if (reduced || enhanced || !ref.current) return;
    const nodes = [...ref.current.querySelectorAll('[data-enter]')];
    const animations = [];
    const timing = contentTiming(getComputedStyle(ref.current));
    const observer = new IntersectionObserver(entries => {
      entries.forEach(entry => {
        if (!entry.isIntersecting) return;
        animations.push(entry.target.animate([
          { opacity: .65, transform: 'translateY(8px)' },
          { opacity: 1, transform: 'none' },
        ], timing));
        observer.unobserve(entry.target);
      });
    }, { threshold: .12, rootMargin: '0px 0px -6% 0px' });
    nodes.forEach(node => observer.observe(node));
    return () => { observer.disconnect(); animations.forEach(animation => animation.cancel()); };
  }, [ref, enhanced, reduced]);
}
