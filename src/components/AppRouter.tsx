/**
 * AppRouter - 应用屏幕路由组件
 *
 * 职责：根据当前 screen 渲染对应的屏幕组件。
 * 所有数据通过 React Context 传入 (useAppStateContext)。
 * 所有 callback 通过 useAppRouterCallbacks hook 集中管理。
 */
import React, { lazy, Suspense, useState, useCallback } from 'react';
import type { Plan } from '../services/ai';
import type { DeliveryCardData, TicketCardData } from './cards/ServiceCards';
import { useAppStateContext } from '../contexts/AppStateContext';
import { useAppRouterCallbacks } from '../hooks/useAppRouterCallbacks';
import ErrorBoundary from './ui/ErrorBoundary';

const Home = lazy(() => import('./screens/Home'));
const Overview = lazy(() => import('./screens/Overview'));
const Itinerary = lazy(() => import('./screens/Itinerary'));
const MerchantDetail = lazy(() => import('./screens/MerchantDetail'));
const Booking = lazy(() => import('./screens/Booking'));
const Payment = lazy(() => import('./screens/Payment'));
const Success = lazy(() => import('./screens/Success'));
const Share = lazy(() => import('./screens/Share'));
const AdjustPlan = lazy(() => import('./screens/AdjustPlan'));
const Backups = lazy(() => import('./screens/Backups'));
const Explore = lazy(() => import('./screens/Explore'));
const ExploreDetail = lazy(() => import('./screens/ExploreDetail'));
const Orders = lazy(() => import('./screens/Orders'));
const Collaborate = lazy(() => import('./screens/Collaborate'));
const Profile = lazy(() => import('./screens/Profile'));
const TripRecord = lazy(() => import('./screens/TripRecord'));
const AIStory = lazy(() => import('./screens/AIStory'));
const Memories = lazy(() => import('./screens/Memories'));
const RestaurantFinder = lazy(() => import('./screens/RestaurantFinder'));
const ServiceFinder = lazy(() => import('./screens/ServiceFinder'));
const TaxiFinder = lazy(() => import('./screens/TaxiFinder'));
const BudgetRecords = lazy(() => import('./screens/BudgetRecords'));

function ScreenFallback() {
  return <div className="h-full w-full bg-[linear-gradient(180deg,#fbfcff_0%,#f6f7fb_100%)]" />;
}

interface AppRouterInnerProps {
  streamingText?: string;
  isStreaming?: boolean;
}

function AppRouterInner({ streamingText = '', isStreaming = false }: AppRouterInnerProps) {
  const state = useAppStateContext();
  const cb = useAppRouterCallbacks(state);
  const paymentIntent =
    state.pendingPaymentIntent?.planId === state.plan?.id ? state.pendingPaymentIntent : null;

  const navigateToOrders = useCallback(
    (tab?: string, planId?: string, planTab?: string) => {
      const params = new URLSearchParams();
      if (tab) params.set('tab', tab);
      if (planId) params.set('detail', planId);
      if (planTab) params.set('planTab', planTab);
      const qs = params.toString();
      const path = '/orders' + (qs ? `?${qs}` : '');
      history.pushState({ screen: 'orders' }, '', path);
      state.navigateToScreen('orders');
    },
    [state.navigateToScreen]
  );

  return (
    <ErrorBoundary>
      <Suspense fallback={<ScreenFallback />}>
        {state.screen === 'home' && (
          <Home
            profiles={state.profiles}
            onUpdateProfiles={state.setProfiles}
            onOpenExplore={cb.handleOpenExplore}
            onOpenProfile={cb.handleOpenProfile}
            startNewTaskSignal={state.homeStartNewTaskSignal}
            onConsumeStartNewTaskSignal={cb.handleConsumeStartNewTaskSignal}
            taskSessions={state.taskSessions}
            activeSessionId={state.activeTaskSessionId}
            onTaskSessionsChange={state.setTaskSessions}
            onActiveSessionChange={state.setActiveTaskSessionId}
            onViewActivity={cb.handleViewActivity}
            onViewItinerary={cb.handleViewItinerary}
            onChecklist={cb.handleChecklist}
            onSavePlan={cb.handleSavePlan}
            onUpdatePlan={state.setPlan}
            onOpenRestaurantFinder={cb.handleOpenRestaurantFinder}
            onViewRestaurant={state.openRestaurantDetail}
            onOpenServiceFinder={cb.handleOpenServiceFinder}
            onOpenTaxiFinder={cb.handleOpenTaxiFinder}
            onViewDeliveryItem={state.openServiceDeliveryDetail}
            onViewTicketItem={state.openServiceActivityDetail}
            savedPlans={state.savedPlans}
            plannerTaskStates={state.plannerTaskStates}
          />
        )}

        {state.screen === 'overview' && state.plan && (
          <ErrorBoundary title="行程概览加载失败">
            <Overview
              plan={state.plan}
              onConfirm={cb.handleOverviewConfirm}
              onShare={cb.handleOverviewShare}
              onBack={state.goBack}
              onViewDetails={cb.handleOverviewDetails}
              peopleCount={state.profiles?.length || 1}
            />
          </ErrorBoundary>
        )}

        {state.screen === 'explore' && (
          <Explore
            onBack={cb.handleExploreBack}
            posts={state.communityPosts}
            onCreatePost={cb.handleCreatePost}
            onInspire={cb.handleInspire}
            onPostSelect={cb.handlePostSelect}
            profiles={state.profiles}
          />
        )}

        {state.screen === 'explore_detail' && state.selectedPost && (
          <ExploreDetail
            post={state.selectedPost}
            relatedPosts={state.communityPosts}
            onPostSelect={cb.handlePostSelect}
            onBack={state.goBack}
            onInspire={cb.handleInspire}
          />
        )}

        {state.screen === 'orders' && (
          <Orders
            savedPlans={state.savedPlans}
            plannerTaskStates={state.plannerTaskStates}
            onViewDetails={cb.handleViewDetails}
            onPlanAgain={cb.handlePlanAgain}
            onAdjustPlan={cb.handleAdjustPlan}
            onRecord={cb.handleRecord}
            onViewStory={cb.handleViewStory}
            onBack={cb.handleOrdersBack}
          />
        )}

        {state.screen === 'profile' && (
          <Profile
            onViewMemories={() => state.navigateTo('memories')}
            profiles={state.profiles}
            onUpdateProfiles={state.setProfiles}
            onOpenPlanCenter={() => navigateToOrders('plans')}
            onOpenBudgetRecords={() => state.navigateTo('budget_records')}
            onOpenOrders={() => navigateToOrders('orders')}
            onNavigateToReady={() => navigateToOrders('plans', undefined, '待出发')}
            onViewOrderDetail={(planId) => navigateToOrders('orders', planId)}
            onBack={cb.handleProfileBack}
            savedPlans={state.savedPlans}
            taskSessions={state.taskSessions}
            plannerTaskStates={state.plannerTaskStates}
            onContinueTask={cb.handleContinueTask}
            onStartNewTask={cb.handleStartNewTask}
          />
        )}

        {state.screen === 'memories' && (
          <Memories
            completedPlans={state.savedPlans.filter(
              (p) => p.id && state.completedPlanIds.has(p.id)
            )}
            plannerTaskStates={state.plannerTaskStates}
            onViewStory={cb.handleMemoriesStory}
            onBack={state.goBack}
          />
        )}

        {state.screen === 'restaurant_finder' && (
          <RestaurantFinder
            items={state.restaurantFinderItems}
            keyword={state.restaurantFinderKeyword}
            city={state.finderCity}
            onBack={state.goBack}
            onSelect={state.openRestaurantDetail}
          />
        )}

        {state.screen === 'service_finder' && (
          <ServiceFinder
            mode={state.serviceFinderMode}
            items={state.serviceFinderItems}
            keyword={state.serviceFinderKeyword}
            city={state.finderCity}
            onBack={state.goBack}
            onSelect={(item) =>
              cb.handleServiceFinderSelect(item as DeliveryCardData | TicketCardData)
            }
          />
        )}

        {state.screen === 'taxi_finder' && (
          <TaxiFinder
            data={state.taxiFinderData}
            onBack={state.goBack}
            onBookingComplete={state.notifyTaxiBookingComplete}
          />
        )}

        {state.screen === 'budget_records' && (
          <BudgetRecords savedPlans={state.savedPlans} onBack={state.goBack} />
        )}

        {state.screen === 'itinerary' && (
          <ErrorBoundary title="行程详情加载失败">
            <Itinerary
              plan={state.plan}
              selectedIds={state.selectedIds}
              bookedIds={state.bookedIds}
              completedPlanIds={state.completedPlanIds}
              onToggleSelect={state.toggleSelectedId}
              onMarkBooked={(ids) => {
                if (state.plan?.id) {
                  state.markActivitiesAsBooked(state.plan.id, ids);
                }
              }}
              onDeselectIds={(ids) => {
                if (state.plan?.id) {
                  state.deselectIds(state.plan.id, ids);
                }
              }}
              onProceedPayment={cb.handleItineraryProceedPayment}
              onActivityClick={cb.handleItineraryActivityClick}
              onBack={state.goBack}
              onShare={cb.handleItineraryShare}
              onUpdatePlan={state.updatePlan}
              profiles={state.profiles}
              copilotMessages={state.plan ? (state.copilotMessagesByPlan[state.plan.id] ?? []) : []}
              onUpdateCopilotMessages={cb.handleUpdateCopilotMessages}
              onNavigate={(screen) => state.navigateToScreen(screen)}
              onOpenTaxiFinder={cb.handleOpenTaxiFinder}
            />
          </ErrorBoundary>
        )}

        {state.screen === 'detail' && (
          <MerchantDetail
            activity={state.selectedActivity}
            onBack={state.goBack}
            onBook={() => state.navigateTo('booking')}
          />
        )}

        {state.screen === 'booking' && (
          <Booking
            activity={state.selectedActivity}
            onBack={state.goBack}
            onProceedToPay={(variant) => {
              if (variant) {
                state.setPendingBookingVariant(variant);
              }
              state.navigateTo('payment');
            }}
          />
        )}

        {state.screen === 'payment' && (
          <ErrorBoundary title="支付页面加载失败">
            <Payment
              activity={state.selectedActivity}
              amount={
                !state.selectedActivity && state.plan
                  ? paymentIntent?.amount || state.paymentAmount
                  : undefined
              }
              title={
                !state.selectedActivity && state.plan
                  ? paymentIntent?.title || state.plan.title
                  : undefined
              }
              serviceCount={paymentIntent?.serviceCount || state.selectedIds.size || 1}
              planId={state.plan?.id}
              activityIds={paymentIntent?.activityIds || Array.from(state.selectedIds)}
              merchantName={
                paymentIntent?.merchantName || state.plan?.activities[0]?.title || '未知商家'
              }
              onBack={cb.handlePaymentBack}
              onPaySuccess={cb.handlePaymentSuccess}
            />
          </ErrorBoundary>
        )}

        {state.screen === 'success' && (
          <Success
            activity={state.selectedActivity}
            title={state.plan?.title}
            orderId={paymentIntent?.orderId}
            onBackToItinerary={cb.handleSuccessBackToItinerary}
            onViewOrders={cb.handleSuccessViewOrders}
            onShare={cb.handleSuccessShare}
          />
        )}

        {state.screen === 'share' && (
          <Share
            plan={state.plan}
            profiles={state.profiles}
            taskState={state.currentTaskState}
            onBack={state.goBack}
            standalone={state.screenStack.length === 1 && state.screen === 'share'}
            onComplete={cb.handleShareComplete}
            onNavigate={state.navigateToScreen}
          />
        )}

        {state.screen === 'adjust' && (
          <AdjustPlan
            plan={state.plan}
            onBack={state.goBack}
            onSelectOption={cb.handleSelectOption}
            onReplaceActivity={
              state.plan
                ? (activityId, newActivity) =>
                    state.replaceActivityInPlan(state.plan!.id, activityId, newActivity)
                : undefined
            }
            onStartCollaboration={cb.handleStartCollaboration}
          />
        )}

        {state.screen === 'collaborate' && (
          <Collaborate plan={state.plan} profiles={state.profiles} onBack={state.goBack} />
        )}

        {state.screen === 'backups' && (
          <Backups
            currentPlan={state.plan}
            onBack={state.goBack}
            onSelectBackup={cb.handleSelectBackup}
          />
        )}

        {state.screen === 'record' && state.plan && (
          <TripRecord
            plan={state.plan}
            onBack={state.goBack}
            completedIds={state.currentCompletedIds}
            bookedIds={state.currentBookedIds}
            selectedIds={state.selectedIds}
            onGenerateStory={cb.handleGenerateStory}
            onRecordChange={cb.handleRecordChange}
          />
        )}

        {state.screen === 'story' && state.plan && (
          <AIStory plan={state.plan} template={state.storyTemplate} onBack={state.goBack} />
        )}
      </Suspense>
    </ErrorBoundary>
  );
}

export default React.memo(AppRouterInner);
