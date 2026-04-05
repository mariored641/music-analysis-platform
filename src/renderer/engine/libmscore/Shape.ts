/**
 * Shape — Bounding box collection for collision detection
 *
 * Port of MuseScore's shape.cpp/h
 * A Shape is a collection of rectangles (ShapeElements) representing
 * the visual extent of a musical element. Used by the Skyline system
 * to detect and prevent collisions.
 */

// ─── Types ────────────────────────────────────────────────────────────────────

export interface ShapeRect {
  x: number
  y: number
  width: number
  height: number
  /** Optional label for debugging */
  label?: string
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

/** Check if two vertical ranges overlap, with optional clearance */
function verticalIntersects(
  ay1: number, ay2: number,
  by1: number, by2: number,
  verticalClearance: number,
): boolean {
  // Zero-height elements don't intersect (shape.h:113-122)
  if (ay1 === ay2 || by1 === by2) return false
  return (ay2 + verticalClearance > by1) && (ay1 < by2 + verticalClearance)
}

// ─── Shape Class ──────────────────────────────────────────────────────────────

export class Shape {
  readonly elements: ShapeRect[] = []

  constructor(rect?: ShapeRect) {
    if (rect) this.elements.push(rect)
  }

  add(rect: ShapeRect): void
  add(shape: Shape): void
  add(arg: ShapeRect | Shape): void {
    if (arg instanceof Shape) {
      this.elements.push(...arg.elements)
    } else {
      this.elements.push(arg)
    }
  }

  /**
   * Add a "wall" — zero-height rectangle that collides with everything.
   * Used to force spacing regardless of vertical position.
   * (shape.cpp: addHorizontalSpacing)
   */
  addHorizontalSpacing(leftEdge: number, rightEdge: number, label?: string): void {
    const eps = 1e-10
    let right = rightEdge
    if (leftEdge === rightEdge) right += eps
    this.elements.push({ x: leftEdge, y: 0, width: right - leftEdge, height: 0, label })
  }

  clear(): void {
    this.elements.length = 0
  }

  get size(): number { return this.elements.length }
  get empty(): boolean { return this.elements.length === 0 }

  // ── Bounds ────────────────────────────────────────────────────────────────

  left(): number {
    let dist = 0
    for (const r of this.elements) {
      if (r.height !== 0 && r.x < dist) dist = r.x
    }
    return -dist
  }

  right(): number {
    let dist = 0
    for (const r of this.elements) {
      const right = r.x + r.width
      if (right > dist) dist = right
    }
    return dist
  }

  top(): number {
    let dist = 1e6
    for (const r of this.elements) {
      if (r.y < dist) dist = r.y
    }
    return dist
  }

  bottom(): number {
    let dist = -1e6
    for (const r of this.elements) {
      const bottom = r.y + r.height
      if (bottom > dist) dist = bottom
    }
    return dist
  }

  // ── Translation ───────────────────────────────────────────────────────────

  translate(dx: number, dy: number): void {
    for (const r of this.elements) {
      r.x += dx
      r.y += dy
    }
  }

  translateX(dx: number): void {
    for (const r of this.elements) { r.x += dx }
  }

  translateY(dy: number): void {
    for (const r of this.elements) { r.y += dy }
  }

  translated(dx: number, dy: number): Shape {
    const s = new Shape()
    for (const r of this.elements) {
      s.elements.push({ ...r, x: r.x + dx, y: r.y + dy })
    }
    return s
  }

  // ── Distance Calculations ─────────────────────────────────────────────────

  /**
   * Minimum horizontal distance so that shape `a` (to the right) doesn't
   * collide with this shape. Returns negative if already clear.
   *
   * Simplified port — no kerning types or item-specific padding.
   * Uses fixed verticalClearance = 0.2 * spatium.
   *
   * (shape.cpp:100-132)
   */
  minHorizontalDistance(a: Shape, spatiumPx: number, padding = 0): number {
    let dist = -1e6
    const verticalClearance = 0.2 * spatiumPx

    for (const r2 of a.elements) {
      const by1 = r2.y
      const by2 = r2.y + r2.height
      for (const r1 of this.elements) {
        const ay1 = r1.y
        const ay2 = r1.y + r1.height
        const intersection = verticalIntersects(ay1, ay2, by1, by2, verticalClearance)
        // Zero-width shapes collide with everything (C++ hack preserved)
        if (intersection || r1.width === 0 || r2.width === 0) {
          const r1Right = r1.x + r1.width
          dist = Math.max(dist, r1Right - r2.x + padding)
        }
      }
    }
    return dist
  }

  /**
   * Minimum vertical distance: this shape is above, `a` is below.
   * (shape.cpp:140-165)
   */
  minVerticalDistance(a: Shape): number {
    if (this.empty || a.empty) return 0
    let dist = -1e6
    for (const r2 of a.elements) {
      if (r2.height <= 0) continue
      const bx1 = r2.x
      const bx2 = r2.x + r2.width
      for (const r1 of this.elements) {
        if (r1.height <= 0) continue
        const ax1 = r1.x
        const ax2 = r1.x + r1.width
        // Check horizontal overlap
        if ((ax2 > bx1) && (ax1 < bx2)) {
          const r1Bottom = r1.y + r1.height
          dist = Math.max(dist, r1Bottom - r2.y)
        }
      }
    }
    return dist
  }

  // ── Intersection Tests ────────────────────────────────────────────────────

  intersectsRect(rr: ShapeRect): boolean {
    for (const r of this.elements) {
      if (r.x < rr.x + rr.width && r.x + r.width > rr.x &&
          r.y < rr.y + rr.height && r.y + r.height > rr.y) {
        return true
      }
    }
    return false
  }

  intersectsShape(other: Shape): boolean {
    for (const r of other.elements) {
      if (this.intersectsRect(r)) return true
    }
    return false
  }

  /**
   * Check if all parts of this shape are above all parts of `a`.
   * (shape.cpp:168-181)
   */
  clearsVertically(a: Shape): boolean {
    for (const r1 of a.elements) {
      for (const r2 of this.elements) {
        // Check horizontal overlap
        if ((r1.x + r1.width > r2.x) && (r1.x < r2.x + r2.width)) {
          if (Math.min(r1.y, r1.y + r1.height) <= Math.max(r2.y, r2.y + r2.height)) {
            return false
          }
        }
      }
    }
    return true
  }

  /**
   * Distance from point to top of shape (negative = overlap).
   * (shape.cpp:208-218)
   */
  topDistance(px: number, py: number): number {
    let dist = 1e6
    for (const r of this.elements) {
      if (px >= r.x && px < r.x + r.width) {
        dist = Math.min(dist, r.y - py)
      }
    }
    return dist
  }

  /**
   * Distance from point to bottom of shape (negative = overlap).
   * (shape.cpp:224-234)
   */
  bottomDistance(px: number, py: number): number {
    let dist = 1e6
    for (const r of this.elements) {
      if (px >= r.x && px < r.x + r.width) {
        dist = Math.min(dist, py - (r.y + r.height))
      }
    }
    return dist
  }

  contains(px: number, py: number): boolean {
    for (const r of this.elements) {
      if (px >= r.x && px < r.x + r.width && py >= r.y && py < r.y + r.height) {
        return true
      }
    }
    return false
  }
}
