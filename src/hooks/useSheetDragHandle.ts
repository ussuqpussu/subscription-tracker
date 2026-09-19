import { createContext, useContext, type PointerEvent as ReactPointerEvent } from 'react'

export const SheetDragHandleContext = createContext<(event: ReactPointerEvent) => void>(() => {})

/** Для грабера внутри контента sheet: onPointerDown={useSheetDragHandle()} запускает drag-to-dismiss. */
export const useSheetDragHandle = () => useContext(SheetDragHandleContext)
