import { Card, CardContent } from "@/components/ui/card";
import { AlertCircle } from "lucide-react";
import { useEffect } from "react";

export default function NotFound() {
  useEffect(() => {
    const raw = window.location.hash.startsWith("#") ? window.location.hash.slice(1) : window.location.hash;
    const normalized = raw.replace(/^\/+/, "").replace(/^\?+/, "");
    const looksLikeAuthCallback =
      normalized.startsWith("access_token=") ||
      normalized.startsWith("refresh_token=") ||
      normalized.startsWith("error=") ||
      normalized.startsWith("type=") ||
      normalized.includes("error_code=") ||
      normalized.includes("sb=");

    if (looksLikeAuthCallback) {
      window.location.hash = "#/login";
    }
  }, []);

  return (
    <div className="min-h-screen w-full flex items-center justify-center bg-gray-50">
      <Card className="w-full max-w-md mx-4">
        <CardContent className="pt-6">
          <div className="flex mb-4 gap-2">
            <AlertCircle className="h-8 w-8 text-red-500" />
            <h1 className="text-2xl font-bold text-gray-900">404 Page Not Found</h1>
          </div>

          <p className="mt-4 text-sm text-gray-600">
            Did you forget to add the page to the router?
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
