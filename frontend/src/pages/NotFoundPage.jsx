import React from "react";
import { Link } from "react-router-dom";
import { ArrowLeft, SearchX } from "lucide-react";
import { Button, Card } from "../components/ui";

export function NotFoundPage() {
  return (
    <div className="flex min-h-screen items-center justify-center px-4 py-10">
      <Card className="max-w-lg p-8 text-center">
        <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-3xl bg-white/5">
          <SearchX className="h-7 w-7 text-slate-300" />
        </div>
        <h1 className="mt-6 font-display text-3xl font-semibold text-white">Page not found</h1>
        <p className="mt-3 text-sm leading-6 text-slate-400">
          The route you tried to open does not exist in the redesigned frontend.
        </p>
        <div className="mt-6">
          <Button asChild variant="primary" className="w-full">
            <Link to="/login" className="inline-flex items-center justify-center gap-2">
              <ArrowLeft className="h-4 w-4" />
              Back to login
            </Link>
          </Button>
        </div>
      </Card>
    </div>
  );
}

