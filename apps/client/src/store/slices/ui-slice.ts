import { createSlice, type PayloadAction } from '@reduxjs/toolkit';

type UiState = {
  authGateEnabled: boolean;
};

const initialState: UiState = {
  authGateEnabled: true,
};

const uiSlice = createSlice({
  name: 'ui',
  initialState,
  reducers: {
    setAuthGateEnabled(state, action: PayloadAction<boolean>) {
      state.authGateEnabled = action.payload;
    },
    enableAuthGate(state) {
      state.authGateEnabled = true;
    },
    disableAuthGate(state) {
      state.authGateEnabled = false;
    },
  },
});

export const { disableAuthGate, enableAuthGate, setAuthGateEnabled } = uiSlice.actions;
export default uiSlice.reducer;
