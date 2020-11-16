import {RefObject, useEffect} from 'react'
import {BezierCurve, Breakpoint, DiscussionThreadEnum, NavSidebar} from '~/types/constEnums'
import useBreakpoint from './useBreakpoint'
import useResizeObserver from './useResizeObserver'

interface ControlBarCoverable {
  id: string
  el: HTMLDivElement
  left: number
  right: number
  height: number
  isExpanded: boolean
}

const coverables = {} as {[id: string]: ControlBarCoverable}
const covering = {el: null, left: 0, right: 0} as {
  el: HTMLDivElement | null
  left: number
  right: number
}

const ensureCovering = (
  coverable: ControlBarCoverable,
  leftBound: number,
  rightBound: number,
  isDrag?: boolean
) => {
  if (!coverable.el) return
  const willBeExpanded = coverable.left > rightBound || coverable.right < leftBound ? true : false
  const height = willBeExpanded ? '100%' : `calc(100% - ${coverable.height}px)`
  const {style} = coverable.el
  style.height = height
  if (isDrag) {
    style.transition = `height 100ms ${BezierCurve.DECELERATE}`
  }
  coverable.isExpanded = willBeExpanded
}

export const useCoverable = (
  id: string,
  ref: RefObject<HTMLDivElement>,
  height: number,
  parentRef?: RefObject<HTMLDivElement>
) => {
  const isDesktop = useBreakpoint(Breakpoint.SIDEBAR_LEFT)
  const updateCoverables = () => {
    const el = ref.current
    if (!el) return
    if (window.innerWidth < Breakpoint.SINGLE_REFLECTION_COLUMN) return
    const bbox = el.getBoundingClientRect()
    const {left, right} = bbox
    const oldCoverable = coverables[id]
    const BUFFER = 8
    const coverable = {
      id,
      el,
      height,
      left: left - BUFFER,
      right: right + BUFFER,
      isExpanded: oldCoverable?.isExpanded ?? false
    }
    if (covering.el) {
      const showRightSidebar = id === 'thread' && isDesktop
      cacheCoveringBBox(showRightSidebar, isDesktop)
      ensureCovering(
        coverable,
        covering.left,
        covering.right - (showRightSidebar ? DiscussionThreadEnum.WIDTH : 0)
      )
      // ensureCovering(coverable, covering.left, covering.right)
    }
    coverables[id] = coverable
  }

  useResizeObserver(updateCoverables, parentRef)

  useEffect(() => {
    updateCoverables()
    return () => {
      const oldCoverable = coverables[id]
      if (oldCoverable) {
        ;(oldCoverable as any).el = null
      }
    }
  }, [])

  return coverables[id]?.isExpanded ?? false
}

export const ensureAllCovering = (leftBound: number, rightBound: number) => {
  Object.values(coverables).forEach((coverable) => {
    ensureCovering(coverable, leftBound, rightBound, true)
  })
}

export const cacheCoveringBBox = (showRightSidebar: boolean, isDesktop: boolean) => {
  if (covering.el) {
    const coveringBBox = covering.el.getBoundingClientRect()
    const {left, right} = coveringBBox
    // covering.left = left + NavSidebar.WIDTH
    covering.left = left - (isDesktop ? NavSidebar.WIDTH : 0)
    // covering.right = right
    covering.right = right + (showRightSidebar && isDesktop ? DiscussionThreadEnum.WIDTH : 0)
    // covering.right = right + DiscussionThreadEnum.WIDTH
  }
  return covering
}

export const useCovering = (ref: RefObject<HTMLDivElement>, showRightSidebar: boolean) => {
  // const isDesktop = useBreakpoint(Breakpoint.SINGLE_REFLECTION_COLUMN)
  const isDesktop = useBreakpoint(Breakpoint.SIDEBAR_LEFT)
  useEffect(() => {
    const el = ref.current
    if (!el) return
    covering.el = el
    if (Object.keys(coverables).length) {
      console.log('useCovering -> coverables <><><><', coverables)
      cacheCoveringBBox(showRightSidebar, isDesktop)
    }
    ensureAllCovering(covering.left, covering.right)
    return () => {
      covering.el = null
    }
  }, [])
}
