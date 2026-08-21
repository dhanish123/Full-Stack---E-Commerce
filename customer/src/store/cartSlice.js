import { createSlice } from "@reduxjs/toolkit"

const initialState = []

const cartSlice = createSlice({
  name: "cart",
  initialState,
  reducers: {
    replaceCart: (_state, action) => action.payload,
    clearCart: () => [],
    removeCartItem: (state, action) => {
      return state.filter(item => item.id !== action.payload)
    },
    decreaseCartItem: (state, action) => {
      const item = state.find(cartItem => cartItem.id === action.payload)
      if (item) {
        item.quantity -= 1
      }
    }
  }
})

export const { replaceCart, clearCart, removeCartItem, decreaseCartItem } = cartSlice.actions
export default cartSlice.reducer
