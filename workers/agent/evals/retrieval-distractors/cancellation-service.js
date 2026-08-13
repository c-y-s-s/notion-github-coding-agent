export function cancelSubscription(subscription) { return { ...subscription, status: "cancelled" }; }
