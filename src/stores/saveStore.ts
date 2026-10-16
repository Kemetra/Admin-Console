import {
  type Rf2ErrorRender,
  type createStore,
  mapRf2Error,
  type updateStore,
} from "@/lib/rf2-queries";

type SaveResponse =
  | Awaited<ReturnType<typeof createStore>>
  | Awaited<ReturnType<typeof updateStore>>;

export interface SaveRequest {
  mode: "create" | "edit";
  /** Required in edit mode. */
  storeId?: string;
  /** The create or update call, already holding its body. */
  submit: () => Promise<SaveResponse>;
}

/** The route to go to on success, or the failure render the form shows. */
export type SaveOutcome = { to: string | undefined } | { render: Rf2ErrorRender };

/** The route to the saved store: the created one's, or the edited one's. */
function savedRoute(mode: SaveRequest["mode"], storeId: string | undefined, data: unknown) {
  const id = mode === "create" ? (data as { id?: string } | undefined)?.id : storeId;
  return id ? `/stores/${id}` : undefined;
}

/** Create or update a store (RT-400, RT-477); a 4xx/5xx becomes a render, a throw propagates. */
export async function saveStore({ mode, storeId, submit }: SaveRequest): Promise<SaveOutcome> {
  const res = await submit();
  if (res.status >= 400) return { render: mapRf2Error({ ...res, context: "store" }) };
  return { to: savedRoute(mode, storeId, res.data) };
}
