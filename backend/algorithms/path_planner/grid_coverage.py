# algorithms/path_planner/grid_coverage.py
from typing import List, Tuple, Literal
from math import radians, cos, sin
from shapely.geometry import Polygon, LineString, Point
from shapely.affinity import rotate
from shapely.ops import unary_union
from pyproj import Transformer

LngLat = Tuple[float, float]  # (lng, lat)

def _make_transformers(ref_lat: float, ref_lng: float):
    # Use UTM zone derived from centroid
    # EPSG:4326 -> UTM auto
    from pyproj import CRS
    utm = CRS.from_user_input(f"+proj=utm +zone={(int((ref_lng+180)//6)+1)} +datum=WGS84 +units=m +no_defs {'+south' if ref_lat<0 else ''}")
    to_xy = Transformer.from_crs("EPSG:4326", utm, always_xy=True).transform
    to_ll = Transformer.from_crs(utm, "EPSG:4326", always_xy=True).transform
    return to_xy, to_ll

def plan_lawnmower(
    boundary: List[LngLat],
    spacing_m: float,
    angle_deg: float,
    start: Literal["NW","NE","SE","SW"]="SW"
) -> List[LngLat]:
    # Close polygon if needed
    if boundary[0] != boundary[-1]:
        boundary = boundary + [boundary[0]]

    # Build polygon in meters
    lngs, lats = zip(*boundary)
    ref_lng = sum(lngs)/len(lngs); ref_lat = sum(lats)/len(lats)
    to_xy, to_ll = _make_transformers(ref_lat, ref_lng)

    poly_xy = Polygon([to_xy(lng, lat) for (lng,lat) in boundary])
    if not poly_xy.is_valid or poly_xy.area == 0:
        raise ValueError("Invalid or zero-area boundary")

    # Rotate so sweep is axis-aligned
    rot = rotate(poly_xy, angle_deg, origin='centroid', use_radians=False)

    # Generate parallel sweep lines across rotated bbox
    minx, miny, maxx, maxy = rot.bounds
    y = miny
    lines = []
    while y <= maxy + 1e-6:
        lines.append(LineString([(minx-10*spacing_m, y), (maxx+10*spacing_m, y)]))
        y += spacing_m

    # Clip lines to polygon
    paths = []
    for i, ln in enumerate(lines):
        segs = rot.intersection(ln)
        if segs.is_empty:
            continue
        if segs.geom_type == "MultiLineString":
            # join disjoint pieces to reduce unnecessary turns (optional)
            for s in segs:
                paths.append((i, s))
        elif segs.geom_type == "LineString":
            paths.append((i, segs))

    # Order segments into lawnmower: reverse every other line
    ordered_pts_xy = []
    for i, seg in paths:
        coords = list(seg.coords)
        pts = coords if (i % 2 == 0) else list(reversed(coords))
        ordered_pts_xy.extend(pts)

    # Rotate back
    inv = rotate(Polygon(), -angle_deg)  # dummy to fetch same API
    # shapely has no direct inverse rotate; we rotate points manually:
    th = radians(-angle_deg)
    cx, cy = poly_xy.centroid.coords[0]
    def inv_rot(p):
        x,y = p
        xr = cos(th)*(x-cx) - sin(th)*(y-cy) + cx
        yr = sin(th)*(x-cx) + cos(th)*(y-cy) + cy
        return xr, yr

    pts_ll: List[LngLat] = []
    last = None
    for x,y in ordered_pts_xy:
        xr, yr = inv_rot((x,y))
        lng, lat = to_ll(xr, yr)
        # down-sample tiny steps (optional, avoids super-dense wps)
        if last is None:
            pts_ll.append((lng, lat)); last = (lng,lat)
        else:
            if abs(lng-last[0]) + abs(lat-last[1]) > 1e-7:
                pts_ll.append((lng, lat)); last = (lng,lat)

    return pts_ll
