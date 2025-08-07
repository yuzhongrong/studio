"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { Database, Loader2, Search, Ship, Wand2, Copy, RefreshCw, AlertCircle } from "lucide-react";
import React, { useEffect, useState, useTransition } from "react";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { format } from 'date-fns';

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { fetchApiData, getFilterSuggestions } from "./actions";
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from "@/components/ui/table"
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";

const formSchema = z.object({
  endpoint: z
    .string()
    .url({ message: "Please enter a valid URL." })
    .default("https://dexscreen-scraper-delta.vercel.app/dex?generated_text=%26filters%5BmarketCap%5D%5Bmin%5D%3D2000000%26filters%5BchainIds%5D%5B0%5D%3Dsolana"),
});

const filterSchema = z.object({
  description: z
    .string()
    .min(10, { message: "Please describe the data you're looking for." }),
});

export default function Home() {
  const { toast } = useToast();
  const [isFetchPending, startFetchTransition] = useTransition();
  const [isSuggestPending, startSuggestTransition] = useTransition();
  const [isDbFetchPending, startDbFetchTransition] = useTransition();

  const [rawData, setRawData] = useState<any>(null);
  const [filteredData, setFilteredData] = useState<any[] | null>(null);
  const [suggestedFilters, setSuggestedFilters] = useState<string[]>([]);
  const [activeFilters, setActiveFilters] = useState<Set<string>>(new Set());
  const [activeTab, setActiveTab] = useState("filtered");
  const [rsiData, setRsiData] = useState<any[] | null>(null);

  
  const apiForm = useForm<z.infer<typeof formSchema>>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      endpoint: "https://dexscreen-scraper-delta.vercel.app/dex?generated_text=%26filters%5BmarketCap%5D%5Bmin%5D%3D2000000%26filters%5BchainIds%5D%5B0%5D%3Dsolana",
    },
  });

  const filterForm = useForm<z.infer<typeof filterSchema>>({
    resolver: zodResolver(filterSchema),
  });

  const performFetch = (endpoint: string) => {
    startFetchTransition(async () => {
      const result = await fetchApiData(endpoint);
      
      if (result.error) {
        toast({
          variant: "destructive",
          title: "Error",
          description: result.error,
        });
      }
      
      if (result.successMessage) {
        toast({
            title: "Success!",
            description: result.successMessage,
        });
      }

      if (result.data) {
        setRawData(result.data);
        setSuggestedFilters([]);
        setActiveFilters(new Set());
        filterForm.reset();
        setRsiData(null); // Invalidate DB data for refetch
      } else {
        setRawData(null);
      }
    });
  };

  const handleFetchData = (values: z.infer<typeof formSchema>) => {
    performFetch(values.endpoint);
  };
  
  const handleSuggestFilters = (values: z.infer<typeof filterSchema>) => {
    if (!rawData) {
      toast({
        variant: "destructive",
        title: "No Data",
        description: "Please fetch data from an API endpoint first.",
      });
      return;
    }
    startSuggestTransition(async () => {
      const result = await getFilterSuggestions({
        rawJson: JSON.stringify(rawData),
        dataDescription: values.description,
      });

      if (result.error) {
        toast({
          variant: "destructive",
          title: "AI Suggestion Error",
          description: result.error,
        });
      } else if (result.suggestions && result.suggestions.length > 0) {
        setSuggestedFilters(result.suggestions);
        toast({
          title: "Suggestions Ready!",
          description: "AI has suggested some filters for you.",
        });
      } else {
        setSuggestedFilters([]);
        toast({
          title: "No suggestions found",
          description: "The AI couldn't determine any filters. Try a different description.",
        });
      }
    });
  };

  const toggleFilter = (filter: string) => {
    setActiveFilters((prev) => {
      const newSet = new Set(prev);
      if (newSet.has(filter)) {
        newSet.delete(filter);
      } else {
        newSet.add(filter);
      }
      return newSet;
    });
  };

  useEffect(() => {
    if (!rawData) {
      setFilteredData(null);
      return;
    }
    
    let dataToFilter = rawData.data && Array.isArray(rawData.data) ? [...rawData.data] : [];
    
    if (activeFilters.size === 0) {
      setFilteredData(dataToFilter);
      return;
    }

    try {
      const appliedFilterFns = Array.from(activeFilters).map((filter) => {
        return new Function('item', `try { return ${filter}; } catch (e) { return false; }`);
      });

      const result = dataToFilter.filter((item) => {
        return appliedFilterFns.every((filterFn) => filterFn(item));
      });
      setFilteredData(result);
    } catch (error) {
      console.error("Filter application error:", error);
      toast({
        variant: "destructive",
        title: "Filter Error",
        description: "One of the suggested filters is invalid. Please try generating new suggestions.",
      });
    }
  }, [rawData, activeFilters, toast]);

  const fetchRsiData = () => {
    startDbFetchTransition(async () => {
        try {
            const response = await fetch('/api/rsi');
            if (!response.ok) {
                const errorData = await response.json();
                throw new Error(errorData.error || 'Failed to fetch RSI data');
            }
            const data = await response.json();
            setRsiData(data);
        } catch(error: any) {
            toast({
              variant: "destructive",
              title: "Database Error",
              description: error.message,
            });
            setRsiData([]);
        }
    });
  }

  useEffect(() => {
    if (activeTab === 'database' && !rsiData) {
      fetchRsiData();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeTab]);

  useEffect(() => {
    const interval = setInterval(() => {
      if(activeTab === 'database') {
        fetchRsiData();
      }
    }, 15000);
    return () => clearInterval(interval);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeTab]);

  const formatMarketCap = (marketCap: number) => {
    if (!marketCap) return 'N/A';
    if (marketCap >= 1_000_000_000) return `${(marketCap / 1_000_000_000).toFixed(2)}B`;
    if (marketCap >= 1_000_000) return `${(marketCap / 1_000_000).toFixed(2)}M`;
    if (marketCap >= 1_000) return `${(marketCap / 1_000).toFixed(2)}K`;
    return marketCap.toFixed(2);
  };

  const formatPrice = (price: number) => {
    if (!price) return 'N/A';
    return price.toPrecision(4);
  }
  
  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text).then(() => {
      toast({
        title: "Copied!",
        description: "Contract address copied to clipboard.",
      });
    });
  };

  return (
    <div className="flex min-h-screen w-full flex-col bg-[#F4F2F9]">
      <header className="sticky top-0 z-10 flex h-16 items-center gap-4 border-b bg-background/80 px-4 backdrop-blur-sm md:px-6">
        <h1 className="flex items-center gap-2 text-xl font-semibold">
          <Ship className="h-6 w-6 text-primary" />
          <span>API Navigator</span>
        </h1>
      </header>
      <main className="flex-1 p-4 md:p-6 lg:p-8">
        <div className="mx-auto grid w-full max-w-7xl gap-6">
          <Card>
            <CardHeader>
              <CardTitle>API Endpoint</CardTitle>
              <CardDescription>
                Enter an API endpoint to fetch data from. The data will be automatically saved to the database every 15 seconds.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Form {...apiForm}>
                <form
                  onSubmit={apiForm.handleSubmit(handleFetchData)}
                  className="flex flex-col items-start gap-4 sm:flex-row"
                >
                  <FormField
                    control={apiForm.control}
                    name="endpoint"
                    render={({ field }) => (
                      <FormItem className="w-full">
                        <FormControl>
                          <Input
                            placeholder="https://api.example.com/data"
                            {...field}
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <Button type="submit" disabled={isFetchPending}>
                    {isFetchPending ? (
                      <Loader2 className="animate-spin" />
                    ) : (
                      <Search />
                    )}
                    <span>Fetch Manually</span>
                  </Button>
                </form>
              </Form>
            </CardContent>
          </Card>

          <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
            <TabsList className="grid w-full grid-cols-3">
              <TabsTrigger value="filtered">Filtered Data</TabsTrigger>
              <TabsTrigger value="raw">Raw JSON</TabsTrigger>
              <TabsTrigger value="database">RSI Database</TabsTrigger>
            </TabsList>
            <TabsContent value="filtered" className="mt-4">
                <Card>
                  <CardHeader>
                    <CardTitle>Intelligent Filtering</CardTitle>
                    <CardDescription>
                      Describe the data you're looking for, and we'll suggest filters. This data is from the last manual fetch.
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-6">
                    <Form {...filterForm}>
                      <form onSubmit={filterForm.handleSubmit(handleSuggestFilters)} className="space-y-4">
                        <FormField
                          control={filterForm.control}
                          name="description"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>I'm looking for data where...</FormLabel>
                              <FormControl>
                                <Textarea
                                  placeholder="e.g., 'the price is less than 0.01' or 'the symbol is WIF'"
                                  {...field}
                                />
                              </FormControl>
                              <FormMessage />
                            </FormItem>
                          )}
                        />
                        <Button type="submit" disabled={isSuggestPending || !rawData} className="bg-accent text-accent-foreground hover:bg-accent/90">
                          {isSuggestPending ? (
                            <Loader2 className="animate-spin" />
                          ) : (
                            <Wand2 />
                          )}
                          <span>Suggest Filters</span>
                        </Button>
                      </form>
                    </Form>
                    
                    {isSuggestPending && (
                      <div className="space-y-2">
                        <Skeleton className="h-6 w-1/4" />
                        <div className="flex flex-wrap gap-2">
                          <Skeleton className="h-8 w-32" />
                          <Skeleton className="h-8 w-48" />
                          <Skeleton className="h-8 w-40" />
                        </div>
                      </div>
                    )}
                    
                    {suggestedFilters.length > 0 && (
                      <div className="space-y-2">
                        <h3 className="text-sm font-medium">Suggested Filters (click to apply)</h3>
                        <div className="flex flex-wrap gap-2">
                          {suggestedFilters.map((filter) => (
                            <Badge
                              key={filter}
                              variant={activeFilters.has(filter) ? "default" : "secondary"}
                              onClick={() => toggleFilter(filter)}
                              className="cursor-pointer transition-all hover:scale-105"
                            >
                              {filter}
                            </Badge>
                          ))}
                        </div>
                      </div>
                    )}

                    <div className="space-y-4">
                       <h3 className="text-lg font-semibold">Results <Badge variant="outline">{filteredData?.length ?? 0} items</Badge></h3>
                       {filteredData && filteredData.length > 0 ? (
                         <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                           {filteredData.map((item, index) => (
                             <Card key={item?.pairAddress || index} className="overflow-hidden">
                               <ScrollArea className="h-72">
                                 <pre className="p-4 font-code text-xs">
                                   {JSON.stringify(item, null, 2)}
                                 </pre>
                               </ScrollArea>
                             </Card>
                           ))}
                         </div>
                       ) : (
                          <div className="flex flex-col items-center justify-center rounded-lg border-2 border-dashed border-muted-foreground/30 bg-muted/50 p-12 text-center">
                            <p className="text-muted-foreground">No results found.</p>
                            <p className="text-sm text-muted-foreground/80">Try fetching some data manually to see filtered results here.</p>
                          </div>
                       )}
                    </div>
                  </CardContent>
                </Card>
              </TabsContent>
            <TabsContent value="raw" className="mt-4">
              <Card>
                <CardHeader>
                  <CardTitle>Raw JSON Response</CardTitle>
                  <CardDescription>
                    This is the complete, unfiltered data from the last manual fetch.
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  {rawData ? (
                    <ScrollArea className="h-[600px] w-full rounded-md border bg-muted/30 p-4">
                      <pre className="font-code text-sm">
                        {JSON.stringify(rawData, null, 2)}
                      </pre>
                    </ScrollArea>
                  ) : (
                    <div className="flex flex-col items-center justify-center rounded-lg border-2 border-dashed border-muted-foreground/30 bg-muted/50 p-12 text-center">
                      <p className="text-muted-foreground">No raw data to display.</p>
                      <p className="text-sm text-muted-foreground/80">Fetch some data manually to see the raw response here.</p>
                    </div>
                  )}
                </CardContent>
              </Card>
            </TabsContent>
            <TabsContent value="database" className="mt-4">
               <Card>
                 <CardHeader>
                   <CardTitle className="flex items-center gap-2">
                     <Database />
                     RSI Data from MongoDB
                   </CardTitle>
                   <CardDescription>
                     This is the data currently stored in your 'rsi_data' collection. It automatically refreshes.
                   </CardDescription>
                 </CardHeader>
                 <CardContent>
                   {isDbFetchPending ? (
                     <div className="space-y-2">
                        <Skeleton className="h-10 w-full" />
                        <Skeleton className="h-10 w-full" />
                        <Skeleton className="h-10 w-full" />
                        <Skeleton className="h-10 w-full" />
                     </div>
                   ) : rsiData && rsiData.length > 0 ? (
                    <TooltipProvider>
                      <ScrollArea className="h-[600px] w-full">
                        <Table>
                            <TableHeader className="sticky top-0 bg-background">
                                <TableRow>
                                    <TableHead>Symbol</TableHead>
                                    <TableHead>Contract</TableHead>
                                    <TableHead className="text-right">Price</TableHead>
                                    <TableHead className="text-right">RSI (1H)</TableHead>
                                    <TableHead className="text-right">RSI (5m)</TableHead>
                                    <TableHead className="text-right">Price Change (24h)</TableHead>
                                    <TableHead className="text-right">Market Cap</TableHead>
                                    <TableHead className="text-right">Pair Created</TableHead>
                                    <TableHead className="text-right">Last Updated</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {rsiData.map((item) => (
                                    <TableRow key={item._id}>
                                        <TableCell className="font-medium">{item.symbol || 'N/A'}</TableCell>
                                        <TableCell>
                                            <div className="flex items-center gap-2">
                                                <span className="font-mono text-xs">
                                                    {item.tokenContractAddress.substring(0, 4)}...{item.tokenContractAddress.substring(item.tokenContractAddress.length - 4)}
                                                </span>
                                                <Tooltip>
                                                    <TooltipTrigger asChild>
                                                        <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => copyToClipboard(item.tokenContractAddress)}>
                                                            <Copy className="h-3 w-3" />
                                                        </Button>
                                                    </TooltipTrigger>
                                                    <TooltipContent>
                                                        <p>Copy address</p>
                                                    </TooltipContent>
                                                </Tooltip>
                                            </div>
                                        </TableCell>
                                        <TableCell className="text-right font-mono">${formatPrice(item.current_price)}</TableCell>
                                        <TableCell className={`text-right font-semibold ${item['rsi-1h'] > 70 ? 'text-destructive' : item['rsi-1h'] < 30 ? 'text-green-600' : ''}`}>
                                            {item['rsi-1h'] ? item['rsi-1h'].toFixed(2) : 'N/A'}
                                        </TableCell>
                                        <TableCell className={`text-right font-semibold ${item['rsi-5m'] > 70 ? 'text-destructive' : item['rsi-5m'] < 30 ? 'text-green-600' : ''}`}>
                                            {item['rsi-5m'] ? item['rsi-5m'].toFixed(2) : 'N/A'}
                                        </TableCell>
                                        <TableCell className={`text-right ${item.priceChange?.h24 > 0 ? 'text-green-600' : 'text-destructive'}`}>
                                            {item.priceChange?.h24 ? `${item.priceChange.h24.toFixed(2)}%` : 'N/A'}
                                        </TableCell>
                                        <TableCell className="text-right">{formatMarketCap(item.marketCap)}</TableCell>
                                        <TableCell className="text-right text-muted-foreground">
                                            {item.pairCreatedAt ? format(new Date(item.pairCreatedAt), "yyyy-MM-dd HH:mm") : 'N/A'}
                                        </TableCell>
                                        <TableCell className="text-right text-muted-foreground">
                                            {item.lastUpdated ? format(new Date(item.lastUpdated), "HH:mm:ss") : 'N/A'}
                                        </TableCell>
                                    </TableRow>
                                ))}
                            </TableBody>
                        </Table>
                      </ScrollArea>
                    </TooltipProvider>
                   ) : (
                     <div className="flex flex-col items-center justify-center rounded-lg border-2 border-dashed border-muted-foreground/30 bg-muted/50 p-12 text-center">
                       <p className="text-muted-foreground">No data in database.</p>
                       <p className="text-sm text-muted-foreground/80">The background task is running. Data should appear here shortly.</p>
                     </div>
                   )}
                 </CardContent>
               </Card>
            </TabsContent>
          </Tabs>
        </div>
      </main>
    </div>
  );
}
