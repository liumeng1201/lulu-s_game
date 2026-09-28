export function getDrawOfferAction(drawOfferBy, currentPlayer) {
  if (!drawOfferBy) return "offer";
  return drawOfferBy === currentPlayer ? "withdraw" : "accept";
}

export function resolveDrawOfferAfterMove(drawOfferBy, movingPlayer) {
  return drawOfferBy && drawOfferBy !== movingPlayer ? null : drawOfferBy;
}
