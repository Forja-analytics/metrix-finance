'use client';

import { useEffect, useState, Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Check, X, Zap, Crown, Sparkles, Loader2 } from 'lucide-react';
import { useStore } from '@/lib/store';
import { useTranslation } from '@/hooks/useTranslation';
import { useAuth } from '@/hooks/useAuth';
import { cn } from '@/lib/utils';

const plans = [
  {
    name: 'Free',
    description: 'Perfect for getting started',
    price: 0,
    period: 'forever',
    icon: Zap,
    priceId: null,
    features: [
      { name: 'Pool discovery', included: true },
      { name: 'Basic market metrics', included: true },
      { name: 'Up to 5 simulations/day', included: true },
      { name: 'Track 1 position', included: true },
      { name: 'Recently viewed pools', included: false },
      { name: 'Advanced analytics', included: false },
      { name: 'Custom alerts', included: false },
      { name: 'API access', included: false },
      { name: 'Priority support', included: false },
    ],
    cta: 'Current Plan',
    popular: false,
    disabled: true,
  },
  {
    name: 'Pro',
    description: 'For serious DeFi investors',
    price: 19,
    period: 'month',
    icon: Crown,
    priceId: process.env.NEXT_PUBLIC_STRIPE_PRO_PRICE_ID || 'price_pro',
    features: [
      { name: 'Pool discovery', included: true },
      { name: 'Advanced market metrics', included: true },
      { name: 'Unlimited simulations', included: true },
      { name: 'Track 25 positions', included: true },
      { name: 'Recently viewed pools', included: true },
      { name: 'Advanced analytics', included: true },
      { name: 'Custom alerts', included: true },
      { name: 'API access', included: false },
      { name: 'Priority support', included: false },
    ],
    cta: 'Upgrade to Pro',
    popular: true,
    disabled: false,
  },
  {
    name: 'Enterprise',
    description: 'For teams and institutions',
    price: 99,
    period: 'month',
    icon: Sparkles,
    priceId: process.env.NEXT_PUBLIC_STRIPE_ENTERPRISE_PRICE_ID || 'price_enterprise',
    features: [
      { name: 'Everything in Pro', included: true },
      { name: 'Unlimited positions', included: true },
      { name: 'Team collaboration', included: true },
      { name: 'White-label options', included: true },
      { name: 'Advanced analytics', included: true },
      { name: 'Custom alerts', included: true },
      { name: 'Full API access', included: true },
      { name: 'Priority support', included: true },
      { name: 'Dedicated account manager', included: true },
    ],
    cta: 'Upgrade to Enterprise',
    popular: false,
    disabled: false,
  },
];

const faqs = [
  {
    question: 'Can I cancel my subscription anytime?',
    answer: 'Yes, you can cancel your subscription at any time. Your access will continue until the end of your billing period.',
  },
  {
    question: 'What payment methods do you accept?',
    answer: 'We accept all major credit cards, PayPal, and cryptocurrency payments including ETH, USDC, and USDT.',
  },
  {
    question: 'Do you offer refunds?',
    answer: 'We offer a 14-day money-back guarantee. If you\'re not satisfied, contact us for a full refund.',
  },
  {
    question: 'Can I upgrade or downgrade my plan?',
    answer: 'Yes, you can change your plan at any time. When upgrading, you\'ll be charged the prorated difference. When downgrading, the change will take effect at your next billing date.',
  },
];

function PricingPageContent() {
  const t = useTranslation();
  const searchParams = useSearchParams();
  const { setAuthModalOpen, isPro } = useStore();
  const { isAuthenticated, subscriptionStatus, createCheckout, openBillingPortal, isLoading, refreshSession } = useAuth();
  const [checkoutLoading, setCheckoutLoading] = useState<string | null>(null);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  // Handle success/cancel URL params
  useEffect(() => {
    const success = searchParams.get('success');
    const canceled = searchParams.get('canceled');

    if (success === 'true') {
      setMessage({ type: 'success', text: 'Payment successful! Your subscription is now active.' });
      refreshSession(); // Refresh to get updated subscription status
    } else if (canceled === 'true') {
      setMessage({ type: 'error', text: 'Payment was canceled. You can try again anytime.' });
    }
  }, [searchParams, refreshSession]);

  const handleUpgrade = async (planName: string, priceId: string | null) => {
    if (!priceId) return;

    // If not authenticated, open auth modal first
    if (!isAuthenticated) {
      setAuthModalOpen(true);
      return;
    }

    setCheckoutLoading(planName);
    const result = await createCheckout(priceId);

    if (result.url) {
      window.location.href = result.url;
    } else {
      setMessage({ type: 'error', text: result.error || 'Failed to start checkout' });
      setCheckoutLoading(null);
    }
  };

  const handleManageSubscription = async () => {
    setCheckoutLoading('manage');
    const result = await openBillingPortal();

    if (result.url) {
      window.location.href = result.url;
    } else {
      setMessage({ type: 'error', text: result.error || 'Failed to open billing portal' });
      setCheckoutLoading(null);
    }
  };

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
      {/* Status Message */}
      {message && (
        <div className={cn(
          'mb-8 p-4 rounded-lg text-center',
          message.type === 'success'
            ? 'bg-green-500/10 border border-green-500/20 text-green-400'
            : 'bg-red-500/10 border border-red-500/20 text-red-400'
        )}>
          {message.text}
          <button
            onClick={() => setMessage(null)}
            className="ml-4 underline hover:no-underline"
          >
            Dismiss
          </button>
        </div>
      )}

      {/* Header */}
      <div className="text-center mb-12">
        <h1 className="text-4xl font-bold mb-4">
          {t('pricingTitle')}
        </h1>
        <p className="text-lg text-muted max-w-2xl mx-auto">
          {t('pricingSubtitle')}
        </p>
        {isAuthenticated && (subscriptionStatus === 'pro' || subscriptionStatus === 'enterprise') && (
          <Button
            variant="outline"
            className="mt-4"
            onClick={handleManageSubscription}
            disabled={checkoutLoading === 'manage'}
          >
            {checkoutLoading === 'manage' ? (
              <Loader2 className="w-4 h-4 animate-spin mr-2" />
            ) : null}
            Manage Subscription
          </Button>
        )}
      </div>

      {/* Pricing Cards */}
      <div className="grid md:grid-cols-3 gap-8 mb-16">
        {plans.map((plan) => {
          const Icon = plan.icon;
          const isCurrentPlan =
            (plan.name === 'Free' && subscriptionStatus === 'free') ||
            (plan.name === 'Pro' && subscriptionStatus === 'pro') ||
            (plan.name === 'Enterprise' && subscriptionStatus === 'enterprise');
          const isUpgrading = checkoutLoading === plan.name;

          return (
            <Card
              key={plan.name}
              className={cn(
                'relative p-6 flex flex-col',
                plan.popular && 'border-primary ring-2 ring-primary/20'
              )}
            >
              {plan.popular && (
                <div className="absolute -top-3 left-1/2 -translate-x-1/2">
                  <span className="bg-primary text-white text-xs font-medium px-3 py-1 rounded-full">
                    Most Popular
                  </span>
                </div>
              )}

              <div className="flex items-center gap-3 mb-4">
                <div className={cn(
                  'p-2 rounded-lg',
                  plan.popular ? 'bg-primary/20 text-primary' : 'bg-card-hover text-muted'
                )}>
                  <Icon className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="font-semibold text-lg">{plan.name}</h3>
                  <p className="text-sm text-muted">{plan.description}</p>
                </div>
              </div>

              <div className="mb-6">
                <span className="text-4xl font-bold">${plan.price}</span>
                <span className="text-muted">/{plan.period}</span>
              </div>

              <ul className="space-y-3 mb-8 flex-1">
                {plan.features.map((feature) => (
                  <li key={feature.name} className="flex items-center gap-3">
                    {feature.included ? (
                      <Check className="w-4 h-4 text-success flex-shrink-0" />
                    ) : (
                      <X className="w-4 h-4 text-muted flex-shrink-0" />
                    )}
                    <span className={cn('text-sm', !feature.included && 'text-muted')}>
                      {feature.name}
                    </span>
                  </li>
                ))}
              </ul>

              <Button
                variant={plan.popular ? 'primary' : 'secondary'}
                size="lg"
                className="w-full"
                disabled={isCurrentPlan || isUpgrading || plan.disabled}
                onClick={() => handleUpgrade(plan.name, plan.priceId)}
              >
                {isUpgrading ? (
                  <Loader2 className="w-4 h-4 animate-spin mr-2" />
                ) : null}
                {isCurrentPlan ? t('currentPlan') : plan.cta}
              </Button>
            </Card>
          );
        })}
      </div>

      {/* Features Comparison */}
      <div className="mb-16">
        <h2 className="text-2xl font-bold text-center mb-8">Compare Features</h2>
        <Card className="overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-border">
                  <th className="text-left p-4 text-sm font-medium">Feature</th>
                  <th className="text-center p-4 text-sm font-medium">Free</th>
                  <th className="text-center p-4 text-sm font-medium text-primary">Pro</th>
                  <th className="text-center p-4 text-sm font-medium">Enterprise</th>
                </tr>
              </thead>
              <tbody>
                {[
                  { feature: 'Pool Discovery', free: true, pro: true, enterprise: true },
                  { feature: 'Market Metrics', free: 'Basic', pro: 'Advanced', enterprise: 'Advanced' },
                  { feature: 'Simulations', free: '5/day', pro: 'Unlimited', enterprise: 'Unlimited' },
                  { feature: 'Position Tracking', free: '1', pro: '25', enterprise: 'Unlimited' },
                  { feature: 'Recently Viewed', free: false, pro: true, enterprise: true },
                  { feature: 'Custom Alerts', free: false, pro: true, enterprise: true },
                  { feature: 'API Access', free: false, pro: false, enterprise: true },
                  { feature: 'Priority Support', free: false, pro: false, enterprise: true },
                ].map((row) => (
                  <tr key={row.feature} className="border-b border-border hover:bg-card-hover">
                    <td className="p-4 text-sm">{row.feature}</td>
                    <td className="p-4 text-center">
                      <FeatureValue value={row.free} />
                    </td>
                    <td className="p-4 text-center bg-primary/5">
                      <FeatureValue value={row.pro} />
                    </td>
                    <td className="p-4 text-center">
                      <FeatureValue value={row.enterprise} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      </div>

      {/* FAQ */}
      <div className="max-w-3xl mx-auto">
        <h2 className="text-2xl font-bold text-center mb-8">Frequently Asked Questions</h2>
        <div className="space-y-4">
          {faqs.map((faq) => (
            <Card key={faq.question} className="p-6">
              <h3 className="font-medium mb-2">{faq.question}</h3>
              <p className="text-sm text-muted">{faq.answer}</p>
            </Card>
          ))}
        </div>
      </div>

      {/* CTA */}
      <div className="text-center mt-16 p-12 bg-gradient-to-r from-primary/10 to-purple-500/10 rounded-2xl border border-primary/20">
        <h2 className="text-2xl font-bold mb-4">Ready to Optimize Your DeFi Returns?</h2>
        <p className="text-muted mb-6 max-w-xl mx-auto">
          Join thousands of DeFi investors using Metrix to discover high-performing pools and maximize their liquidity provision returns.
        </p>
        <Button size="lg" onClick={() => setAuthModalOpen(true)}>
          Get Started Free
        </Button>
      </div>
    </div>
  );
}

function FeatureValue({ value }: { value: boolean | string }) {
  if (typeof value === 'boolean') {
    return value ? (
      <Check className="w-4 h-4 text-success mx-auto" />
    ) : (
      <X className="w-4 h-4 text-muted mx-auto" />
    );
  }
  return <span className="text-sm">{value}</span>;
}

export default function PricingPage() {
  return (
    <Suspense fallback={<div className="max-w-7xl mx-auto px-4 py-12 text-center">Loading...</div>}>
      <PricingPageContent />
    </Suspense>
  );
}
