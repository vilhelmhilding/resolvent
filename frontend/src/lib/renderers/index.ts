import type { Camera } from './3d/camera'
import type { RendererMap } from './types'

import { drawFunctionPlot }   from './2d/function-plot'
import { drawUnitCircle }     from './2d/unit-circle'
import { drawComplexPoint }   from './2d/complex-point'
import { drawScalar }         from './2d/scalar'
import { drawSpiralSum }      from './2d/spiral-sum'
import { drawParametricCurve } from './2d/parametric-curve'

import { makeFunctionPlot3D }   from './3d/function-plot'
import { makeScalar3D }         from './3d/scalar'
import { makeSpiralSum3D }      from './3d/spiral-sum'
import { makeUnitCircle3D }     from './3d/unit-circle'
import { makeComplexPoint3D }   from './3d/complex-point'
import { makeParametricCurve3D } from './3d/parametric-curve'

export const drawers2D: RendererMap = {
  function_plot:    drawFunctionPlot,
  unit_circle:      drawUnitCircle,
  complex_point:    drawComplexPoint,
  scalar:           drawScalar,
  spiral_sum:       drawSpiralSum,
  parametric_curve: drawParametricCurve,
}

export function buildDrawers3D(cam: Camera): RendererMap {
  return {
    function_plot:    makeFunctionPlot3D(cam),
    scalar:           makeScalar3D(cam),
    spiral_sum:       makeSpiralSum3D(cam),
    unit_circle:      makeUnitCircle3D(cam),
    complex_point:    makeComplexPoint3D(cam),
    parametric_curve: makeParametricCurve3D(cam),
  }
}
