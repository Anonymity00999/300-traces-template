import data0 from "./trace-data-0.json";
import data1 from "./trace-data-1.json";
import data2 from "./trace-data-2.json";
import { prepareTraceData } from "./trace-types";

export { TYPE_LABELS, type Trace, type TraceType } from "./trace-types";

/** The complete source archive is only needed inside the private workspace. */
export const TRACE_DATA = prepareTraceData([...data0, ...data1, ...data2]);
