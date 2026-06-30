import React from "react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import PitcherObservationForm from "@/components/observations/PitcherObservationForm";
import CatcherObservationForm from "@/components/observations/CatcherObservationForm";
import BaserunnerObservationForm from "@/components/observations/BaserunnerObservationForm";

export default function Observations() {
  return (
    <div className="max-w-4xl mx-auto space-y-6">
      <div>
        <h1 className="font-heading text-3xl font-bold tracking-tight">Observations</h1>
        <p className="text-muted-foreground mt-1">Scout notes for pitchers, catchers, and baserunners</p>
      </div>

      <Tabs defaultValue="pitcher">
        <TabsList className="w-full grid grid-cols-3">
          <TabsTrigger value="pitcher">Pitcher</TabsTrigger>
          <TabsTrigger value="catcher">Catcher</TabsTrigger>
          <TabsTrigger value="baserunner">Baserunner</TabsTrigger>
        </TabsList>

        <TabsContent value="pitcher" className="mt-4">
          <PitcherObservationForm />
        </TabsContent>
        <TabsContent value="catcher" className="mt-4">
          <CatcherObservationForm />
        </TabsContent>
        <TabsContent value="baserunner" className="mt-4">
          <BaserunnerObservationForm />
        </TabsContent>
      </Tabs>
    </div>
  );
}