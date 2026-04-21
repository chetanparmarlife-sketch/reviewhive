import { useEffect } from "react";
import { Switch, Route, Router } from "wouter";
import { useHashLocation } from "wouter/use-hash-location";
import { queryClient } from "./lib/queryClient";
import { QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { SetupBanner } from "@/components/SetupBanner";
import { initSession } from "@/lib/session";
import NotFound from "@/pages/not-found";

import Landing from "@/pages/Landing";
import Login from "@/pages/Login";
import Signup from "@/pages/Signup";
import AdminLogin from "@/pages/AdminLogin";
import Campaigns from "@/pages/Campaigns";
import CampaignDetail from "@/pages/CampaignDetail";
import MyApplications from "@/pages/MyApplications";
import Wallet from "@/pages/Wallet";
import Profile from "@/pages/Profile";
import Notifications from "@/pages/Notifications";

import AdminDashboard from "@/pages/admin/AdminDashboard";
import AdminCampaigns from "@/pages/admin/AdminCampaigns";
import AdminCampaignDetail from "@/pages/admin/AdminCampaignDetail";
import AdminSubmissions from "@/pages/admin/AdminSubmissions";
import AdminPayouts from "@/pages/admin/AdminPayouts";
import AdminUsers from "@/pages/admin/AdminUsers";
import AdminBrands from "@/pages/admin/AdminBrands";

function AppRouter() {
  return (
    <Switch>
      <Route path="/" component={Landing} />
      <Route path="/login" component={Login} />
      <Route path="/signup" component={Signup} />
      <Route path="/admin/login" component={AdminLogin} />

      <Route path="/campaigns" component={Campaigns} />
      <Route path="/campaigns/:id" component={CampaignDetail} />
      <Route path="/applications" component={MyApplications} />
      <Route path="/wallet" component={Wallet} />
      <Route path="/profile" component={Profile} />
      <Route path="/notifications" component={Notifications} />

      <Route path="/admin" component={AdminDashboard} />
      <Route path="/admin/campaigns" component={AdminCampaigns} />
      <Route path="/admin/campaigns/:id" component={AdminCampaignDetail} />
      <Route path="/admin/submissions" component={AdminSubmissions} />
      <Route path="/admin/payouts" component={AdminPayouts} />
      <Route path="/admin/users" component={AdminUsers} />
      <Route path="/admin/brands" component={AdminBrands} />

      <Route component={NotFound} />
    </Switch>
  );
}

function App() {
  useEffect(() => { void initSession(); }, []);

  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <SetupBanner />
        <Toaster />
        <Router hook={useHashLocation}>
          <AppRouter />
        </Router>
      </TooltipProvider>
    </QueryClientProvider>
  );
}

export default App;
