import { useParams, Link } from "react-router-dom";
import { ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";

export default function TaskDetail() {
  const { id } = useParams<{ id: string }>();

  return (
    <div className="p-6 lg:p-10 max-w-3xl">
      <Button variant="ghost" size="sm" asChild className="mb-4">
        <Link to="/tasks">
          <ArrowLeft className="w-4 h-4 mr-1.5" /> Back to Tasks
        </Link>
      </Button>
      <Card className="border-border shadow-none">
        <CardContent className="py-12 text-center">
          <h1 className="text-xl font-semibold text-foreground">Task Detail</h1>
          <p className="text-sm text-muted-foreground mt-2">
            Detail view for task <code className="text-xs">{id}</code> coming soon.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
