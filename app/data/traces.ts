import data0 from "./trace-data-0.json";
import data1 from "./trace-data-1.json";
import data2 from "./trace-data-2.json";
import { prepareTraceData, type Trace } from "./trace-types";

export type { Trace, TraceType } from "./trace-types";

/**
 * The reader carries the reviewed archive in the static build. The separate
 * archive-data files are still emitted for inspection and future import
 * tooling, but reading no longer depends on a second request after the page
 * has loaded. This makes the archive core usable while APIs are offline.
 */
export const initialTraceData: Trace[] = prepareTraceData([...data0, ...data1, ...data2]);
