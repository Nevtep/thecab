import assert from "node:assert/strict";
import test from "node:test";

import {
  normalizeWalletAddress,
  resolveAuthenticatedWalletAddress,
  resolveDebugWalletAddress,
  resolveWalletAuthMode,
} from "@/wallet/walletAuth.shared";

test("resolveWalletAuthMode enforces PROD explicitly", () => {
  assert.equal(resolveWalletAuthMode({ explicitMode: "PROD", nodeEnv: "development" }), "PROD");
});

test("resolveWalletAuthMode defaults to DEBUG outside production", () => {
  assert.equal(resolveWalletAuthMode({ explicitMode: null, nodeEnv: "development" }), "DEBUG");
});

test("resolveDebugWalletAddress normalizes valid addresses", () => {
  assert.equal(
    resolveDebugWalletAddress("0x640DB3C444F30eCF506A2AF2F2D1A81FBCC90F8F"),
    "0x640db3c444f30ecf506a2af2f2d1a81fbcc90f8f",
  );
  assert.equal(resolveDebugWalletAddress("not-an-address"), null);
});

test("resolveAuthenticatedWalletAddress requires cookie match in PROD", () => {
  assert.equal(
    resolveAuthenticatedWalletAddress({
      cookieWalletAddress: "0x640db3c444f30ecf506a2af2f2d1a81fbcc90f8f",
      requestedWalletAddress: "0x640db3c444f30ecf506a2af2f2d1a81fbcc90f8f",
      debugWalletAddress: null,
      mode: "PROD",
    }),
    "0x640db3c444f30ecf506a2af2f2d1a81fbcc90f8f",
  );

  assert.equal(
    resolveAuthenticatedWalletAddress({
      cookieWalletAddress: null,
      requestedWalletAddress: "0x640db3c444f30ecf506a2af2f2d1a81fbcc90f8f",
      debugWalletAddress: null,
      mode: "PROD",
    }),
    null,
  );
});

test("resolveAuthenticatedWalletAddress allows requested or debug wallet in DEBUG", () => {
  assert.equal(
    resolveAuthenticatedWalletAddress({
      cookieWalletAddress: null,
      requestedWalletAddress: "0x640db3c444f30ecf506a2af2f2d1a81fbcc90f8f",
      debugWalletAddress: null,
      mode: "DEBUG",
    }),
    "0x640db3c444f30ecf506a2af2f2d1a81fbcc90f8f",
  );

  assert.equal(
    resolveAuthenticatedWalletAddress({
      cookieWalletAddress: null,
      requestedWalletAddress: null,
      debugWalletAddress: "0x640db3c444f30ecf506a2af2f2d1a81fbcc90f8f",
      mode: "DEBUG",
    }),
    "0x640db3c444f30ecf506a2af2f2d1a81fbcc90f8f",
  );
});

test("normalizeWalletAddress lowercases valid inputs", () => {
  assert.equal(
    normalizeWalletAddress("0x640DB3C444F30eCF506A2AF2F2D1A81FBCC90F8F"),
    "0x640db3c444f30ecf506a2af2f2d1a81fbcc90f8f",
  );
});