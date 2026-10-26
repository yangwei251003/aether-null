import { useEffect } from 'react'
import gsap from 'gsap'
import { ScrollTrigger } from 'gsap/ScrollTrigger'
import { DrawSVGPlugin } from 'gsap/DrawSVGPlugin'
import { MorphSVGPlugin } from 'gsap/MorphSVGPlugin'
import { MotionPathPlugin } from 'gsap/MotionPathPlugin'
import { ScrambleTextPlugin } from 'gsap/ScrambleTextPlugin'
import { SplitText } from 'gsap/SplitText'
import Lenis from 'lenis'
import { FEATURE_FLAGS, MOBILE_FALLBACK } from '../config'
import { navigationSignal, renderSignal, scrollSignal } from '../runtime/signals'

gsap.registerPlugin(ScrollTrigger, DrawSVGPlugin, MorphSVGPlugin, MotionPathPlugin, ScrambleTextPlugin, SplitText)

export function useCinematicScroll(
  enabled: boolean,
  onActChange?: (act: number) => void,
  reducedMotion = false,
) {
  useEffect(() => {
    if (!enabled) return
    const lenis = reducedMotion ? null : new Lenis({
      duration: reducedMotion ? 0 : 1.18,
      smoothWheel: !reducedMotion,
      wheelMultiplier: 0.92,
      touchMultiplier: 1.1,
      lerp: reducedMotion ? 1 : 0.085,
      anchors: true,
    })
    const actSections = Array.from(document.querySelectorAll<HTMLElement>('[data-act]'))
    const activateNearestAct = () => {
      const anchor = window.innerHeight * 0.5
      let candidate: HTMLElement | null = null
      let candidateDistance = Number.POSITIVE_INFINITY
      let candidateTitleDistance = Number.POSITIVE_INFINITY
      for (const section of actSections) {
        const rect = section.getBoundingClientRect()
        const distance = rect.top > anchor
          ? rect.top - anchor
          : rect.bottom < anchor
            ? anchor - rect.bottom
            : 0
        const titleRect = (section.querySelector('h1, h2') ?? section).getBoundingClientRect()
        const titleDistance = Math.abs(titleRect.top + titleRect.height * 0.5 - anchor)
        if (distance < candidateDistance || (distance === candidateDistance && titleDistance < candidateTitleDistance)) {
          candidate = section
          candidateDistance = distance
          candidateTitleDistance = titleDistance
        }
      }
      if (!candidate) return
      const nextAct = Number(candidate.dataset.act ?? 1)
      if (nextAct === scrollSignal.act) return
      scrollSignal.act = nextAct
      onActChange?.(nextAct)
    }
    const navigate = (target: HTMLElement, immediate = false) => {
      const complete = () => {
        ScrollTrigger.update()
        activateNearestAct()
        renderSignal.invalidate?.()
      }
      if (!lenis) {
        target.scrollIntoView({ behavior: 'auto', block: 'start' })
        window.requestAnimationFrame(complete)
        return
      }
      lenis.scrollTo(target, {
        immediate: immediate || reducedMotion,
        duration: immediate || reducedMotion ? 0 : 1.08,
        lock: !immediate,
        force: true,
        onComplete: complete,
      })
    }
    navigationSignal.scrollTo = navigate

    const onLenisScroll = (event: { progress: number; velocity: number; direction: number }) => {
      scrollSignal.progress = event.progress
      scrollSignal.velocity += (event.velocity - scrollSignal.velocity) * 0.28
      scrollSignal.direction = event.direction >= 0 ? 1 : -1
      document.documentElement.style.setProperty('--scroll-velocity', `${Math.min(18, Math.abs(event.velocity))}`)
      if (FEATURE_FLAGS.scrollAwareNavigation && !reducedMotion) {
        if (event.progress < 0.02 || event.direction < 0) {
          document.documentElement.dataset.scrollDirection = 'up'
        } else if (Math.abs(event.velocity) > 0.45) {
          document.documentElement.dataset.scrollDirection = 'down'
        }
      }
      ScrollTrigger.update()
      activateNearestAct()
      renderSignal.invalidate?.()
    }
    const onNativeScroll = () => {
      const maxScroll = Math.max(1, document.documentElement.scrollHeight - window.innerHeight)
      scrollSignal.progress = window.scrollY / maxScroll
      scrollSignal.velocity = 0
      ScrollTrigger.update()
      activateNearestAct()
      renderSignal.invalidate?.()
    }
    if (lenis) lenis.on('scroll', onLenisScroll)
    else window.addEventListener('scroll', onNativeScroll, { passive: true })

    const tick = (time: number) => {
      if (!renderSignal.hidden) lenis?.raf(time * 1000)
    }
    if (lenis) {
      gsap.ticker.add(tick)
      gsap.ticker.lagSmoothing(0)
    }

    const splits: SplitText[] = []
    const responsiveMedia = gsap.matchMedia()
    const ctx = gsap.context(() => {
      actSections.forEach((section, index) => {
        ScrollTrigger.create({
          trigger: section,
          start: 'top 55%',
          end: 'bottom 45%',
          onEnter: () => {
            scrollSignal.act = Number(section.dataset.act ?? index + 1)
            onActChange?.(scrollSignal.act)
          },
          onEnterBack: () => {
            scrollSignal.act = Number(section.dataset.act ?? index + 1)
            onActChange?.(scrollSignal.act)
          },
          onUpdate: (self) => {
            if (scrollSignal.act === Number(section.dataset.act ?? index + 1)) {
              scrollSignal.actProgress = self.progress
            }
          },
        })
      })

      if (!reducedMotion) {
        gsap.utils.toArray<HTMLElement>('[data-native-split]').forEach((element) => {
          const split = SplitText.create(element, { type: 'chars', smartWrap: true, aria: 'auto' })
          splits.push(split)
          gsap.fromTo(split.chars, { opacity: 0, yPercent: 80 }, {
            opacity: 1,
            yPercent: 0,
            duration: 0.85,
            stagger: 0.025,
            ease: 'expo.out',
            scrollTrigger: { trigger: element, start: 'top 82%', once: true },
          })
        })

        gsap.utils.toArray<HTMLElement>('[data-reveal]').forEach((element) => {
          gsap.fromTo(
            element,
            { yPercent: 20, opacity: 0, clipPath: 'inset(0 0 100% 0)' },
            {
              yPercent: 0,
              opacity: 1,
              clipPath: 'inset(0 0 0% 0)',
              duration: 1.15,
              ease: 'expo.out',
              scrollTrigger: { trigger: element, start: 'top 84%', once: true },
            },
          )
        })

        gsap.utils.toArray<HTMLElement>('[data-split]').forEach((element) => {
          const characters = element.querySelectorAll('[data-char]')
          gsap.fromTo(
            characters,
            { yPercent: 115, rotateX: -78, opacity: 0 },
            {
              yPercent: 0,
              rotateX: 0,
              opacity: 1,
              duration: 0.95,
              stagger: 0.022,
              ease: 'expo.out',
              scrollTrigger: { trigger: element, start: 'top 78%', once: true },
            },
          )
        })

        gsap.utils.toArray<HTMLElement>('[data-parallax]').forEach((element) => {
          const amount = Number(element.dataset.parallax ?? 12)
          gsap.fromTo(element, { yPercent: -amount }, {
            yPercent: amount,
            ease: 'none',
            scrollTrigger: { trigger: element, start: 'top bottom', end: 'bottom top', scrub: 1 },
          })
        })

        const variableTitle = document.querySelector<HTMLElement>('[data-variable-title]')
        if (variableTitle) {
          gsap.fromTo(
            variableTitle,
            { fontVariationSettings: "'wdth' 58, 'wght' 420", letterSpacing: '-0.055em' },
            {
              fontVariationSettings: "'wdth' 78, 'wght' 720",
              letterSpacing: '-0.105em',
              ease: 'none',
              scrollTrigger: {
                trigger: '.awakening',
                start: 'top top',
                end: 'bottom top',
                scrub: 1.15,
              },
            },
          )
        }

        const artifactStage = document.querySelector<HTMLElement>('.artifacts__stage')
        const artifactTrack = document.querySelector<HTMLElement>('.artifacts__track')
        responsiveMedia.add(`(min-width: ${MOBILE_FALLBACK.breakpoint}px) and (hover: hover) and (pointer: fine)`, () => {
          if (!artifactStage || !artifactTrack) return
          const distance = () => Math.max(0, artifactTrack.scrollWidth - window.innerWidth + window.innerWidth * 0.12)
          gsap.to(artifactTrack, {
            x: () => -distance(),
            ease: 'none',
            scrollTrigger: {
              trigger: artifactStage,
              start: 'top top',
              end: () => `+=${distance() * 1.05}`,
              pin: true,
              scrub: 1,
              invalidateOnRefresh: true,
            },
          })
        })

        const ocean = document.querySelector<HTMLElement>('.ocean__visual')
        if (ocean) {
          gsap.fromTo(ocean, { rotateX: 58, scale: 1.35, yPercent: 16 }, {
            rotateX: 0,
            scale: 1,
            yPercent: -10,
            ease: 'none',
            scrollTrigger: { trigger: '.ocean', start: 'top bottom', end: 'bottom top', scrub: 1.2 },
          })
        }

        const vectorPaths = gsap.utils.toArray<SVGPathElement>('[data-vector-path]')
        vectorPaths.forEach((path, index) => {
          gsap.fromTo(path, { drawSVG: '0%' }, {
            drawSVG: '100%',
            ease: 'none',
            scrollTrigger: { trigger: '.descent', start: 'top 70%', end: 'bottom 35%', scrub: 1 + index * 0.25 },
          })
        })
        const morphSource = document.querySelector<SVGPathElement>('[data-vector-morph]')
        const morphTarget = document.querySelector<SVGPathElement>('[data-vector-target]')
        if (morphSource && morphTarget) {
          gsap.to(morphSource, {
            morphSVG: morphTarget,
            ease: 'none',
            scrollTrigger: { trigger: '.descent', start: 'top 45%', end: 'bottom 30%', scrub: 1 },
          })
        }
        const vectorOrb = document.querySelector<SVGCircleElement>('[data-vector-orb]')
        if (vectorOrb && morphSource) {
          gsap.to(vectorOrb, {
            motionPath: { path: morphSource, align: morphSource, alignOrigin: [0.5, 0.5] },
            ease: 'none',
            scrollTrigger: { trigger: '.descent', start: 'top 70%', end: 'bottom 25%', scrub: 0.8 },
          })
        }
        const scrambled = document.querySelector<HTMLElement>('[data-scramble]')
        if (scrambled) {
          gsap.to(scrambled, {
            scrambleText: { text: 'DEPTH::UNMAPPED', chars: 'AETHER0123456789/+' },
            duration: 1.1,
            scrollTrigger: { trigger: '.descent', start: '52% center', toggleActions: 'play none none reverse' },
          })
        }
      }
    })

    const magneticElements = Array.from(document.querySelectorAll<HTMLElement>('.magnetic'))
    const magneticCleanups = magneticElements.map((element) => {
      const move = (event: PointerEvent) => {
        if (!window.matchMedia('(hover: hover) and (pointer: fine)').matches) return
        const rect = element.getBoundingClientRect()
        const x = (event.clientX - rect.left - rect.width / 2) * 0.16
        const y = (event.clientY - rect.top - rect.height / 2) * 0.16
        element.style.setProperty('--magnetic-x', `${x}px`)
        element.style.setProperty('--magnetic-y', `${y}px`)
      }
      const leave = () => {
        element.style.setProperty('--magnetic-x', '0px')
        element.style.setProperty('--magnetic-y', '0px')
      }
      element.addEventListener('pointermove', move)
      element.addEventListener('pointerleave', leave)
      return () => {
        element.removeEventListener('pointermove', move)
        element.removeEventListener('pointerleave', leave)
        element.style.removeProperty('--magnetic-x')
        element.style.removeProperty('--magnetic-y')
      }
    })

    const onVisibility = () => {
      renderSignal.hidden = document.hidden
      if (document.hidden) lenis?.stop()
      else lenis?.start()
    }
    document.addEventListener('visibilitychange', onVisibility)
    const refreshTimer = window.setTimeout(() => ScrollTrigger.refresh(), 100)

    return () => {
      window.clearTimeout(refreshTimer)
      document.removeEventListener('visibilitychange', onVisibility)
      if (lenis) {
        gsap.ticker.remove(tick)
        gsap.ticker.lagSmoothing(500, 33)
        lenis.off('scroll', onLenisScroll)
        lenis.destroy()
      } else {
        window.removeEventListener('scroll', onNativeScroll)
      }
      if (navigationSignal.scrollTo === navigate) navigationSignal.scrollTo = null
      delete document.documentElement.dataset.scrollDirection
      responsiveMedia.revert()
      ctx.revert()
      splits.forEach((split) => split.revert())
      magneticCleanups.forEach((cleanup) => cleanup())
    }
  }, [enabled, onActChange, reducedMotion])
}
