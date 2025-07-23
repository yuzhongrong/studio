'use client';

import React, { useState, useTransition, useEffect } from 'react';
import { zodResolver } from '@hookform/resolvers/zod';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { Wallet, TrendingUp, TrendingDown, Repeat, PlusCircle, Loader2, Copy } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { useToast } from '@/hooks/use-toast';
import { generateNewWallet, listWallets, executePump, executeDump, executeWashTrade } from './actions';
import { Separator } from '@/components/ui/separator';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';

const pumpSchema = z.object({
  tokenAddress: z.string().min(1, { message: 'Token address is required.' }),
  amount: z.coerce.number().positive({ message: 'Amount must be a positive number.' }),
});

const dumpSchema = z.object({
  tokenAddress: z.string().min(1, { message: 'Token address is required.' }),
  amount: z.coerce.number().positive({ message: 'Amount must be a positive number.' }),
});

const washTradeSchema = z.object({
  tokenAddress: z.string().min(1, { message: 'Token address is required.' }),
  tradeCount: z.coerce.number().int().positive({ message: 'Trade count must be a positive integer.' }),
  tradeAmount: z.coerce.number().positive({ message: 'Amount per trade must be positive.' }),
});

type Wallet = {
    publicKey: string;
    name: string;
}

export default function OperationsPage() {
  const { toast } = useToast();
  const [isPending, startTransition] = useTransition();
  const [wallets, setWallets] = useState<Wallet[]>([]);

  const pumpForm = useForm<z.infer<typeof pumpSchema>>({ resolver: zodResolver(pumpSchema) });
  const dumpForm = useForm<z.infer<typeof dumpSchema>>({ resolver: zodResolver(dumpSchema) });
  const washTradeForm = useForm<z.infer<typeof washTradeSchema>>({ resolver: zodResolver(washTradeSchema) });

  const fetchWallets = () => {
    startTransition(async () => {
        const result = await listWallets();
        if (result.success && result.wallets) {
            setWallets(result.wallets);
        } else {
            toast({ variant: 'destructive', title: 'Error', description: result.error });
        }
    });
  };

  useEffect(() => {
    fetchWallets();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleGenerateWallet = () => {
    startTransition(async () => {
      const result = await generateNewWallet();
      if (result.success) {
        toast({ title: 'Success', description: `New wallet ${result.publicKey} generated.` });
        fetchWallets(); // Refresh wallet list
      } else {
        toast({ variant: 'destructive', title: 'Error', description: result.error });
      }
    });
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text).then(() => {
      toast({ title: "Copied!", description: "Wallet address copied to clipboard." });
    });
  };

  const onActionSubmit = (action: (values: any) => Promise<any>, values: any) => {
    startTransition(async () => {
        const result = await action(values);
        if (result.success) {
            toast({ title: 'Success', description: result.message });
        } else {
             const errorMessage = typeof result.error === 'object' ? JSON.stringify(result.error) : result.error;
             toast({ variant: 'destructive', title: 'Error', description: errorMessage });
        }
    });
  };

  return (
    <div className="flex min-h-screen w-full flex-col bg-muted/40">
       <header className="sticky top-0 z-10 flex h-16 items-center gap-4 border-b bg-background px-4 md:px-6">
        <h1 className="flex items-center gap-2 text-xl font-semibold">
          Market Operations
        </h1>
      </header>
      <main className="flex-1 p-4 md:p-6 lg:p-8">
        <div className="mx-auto grid w-full max-w-4xl gap-8">
            <Card>
                <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                        <Wallet /> Wallet Management
                    </CardTitle>
                    <CardDescription>
                        Generate and manage wallets for market operations. Secrets are stored in the database.
                    </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                    <Button onClick={handleGenerateWallet} disabled={isPending}>
                        {isPending ? <Loader2 className="animate-spin" /> : <PlusCircle />}
                        Generate New Wallet
                    </Button>
                    <Separator />
                    <h3 className="text-md font-medium">Available Wallets ({wallets.length})</h3>
                    <div className="space-y-2 rounded-md border p-2 max-h-60 overflow-y-auto">
                        {wallets.length > 0 ? wallets.map(wallet => (
                            <div key={wallet.publicKey} className="flex items-center justify-between p-2 bg-muted rounded-md">
                                <span className="font-mono text-sm">{wallet.name}: {wallet.publicKey}</span>
                                <TooltipProvider>
                                    <Tooltip>
                                        <TooltipTrigger asChild>
                                            <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => copyToClipboard(wallet.publicKey)}>
                                                <Copy className="h-4 w-4" />
                                            </Button>
                                        </TooltipTrigger>
                                        <TooltipContent><p>Copy Address</p></TooltipContent>
                                    </Tooltip>
                                </TooltipProvider>
                            </div>
                        )) : <p className="text-sm text-muted-foreground p-2">No wallets generated yet.</p>}
                    </div>
                </CardContent>
            </Card>

            <div className="grid md:grid-cols-2 gap-8">
                <Card>
                    <CardHeader>
                        <CardTitle className="flex items-center gap-2 text-green-600"><TrendingUp /> Pump</CardTitle>
                        <CardDescription>Execute a buy order to increase token price.</CardDescription>
                    </CardHeader>
                    <CardContent>
                        <Form {...pumpForm}>
                            <form onSubmit={pumpForm.handleSubmit((values) => onActionSubmit(executePump, values))} className="space-y-4">
                                <FormField control={pumpForm.control} name="tokenAddress" render={({ field }) => (
                                    <FormItem>
                                        <FormLabel>Token Contract Address</FormLabel>
                                        <FormControl><Input placeholder="SOL or token address" {...field} /></FormControl>
                                        <FormMessage />
                                    </FormItem>
                                )}/>
                                <FormField control={pumpForm.control} name="amount" render={({ field }) => (
                                    <FormItem>
                                        <FormLabel>Buy Amount (in SOL)</FormLabel>
                                        <FormControl><Input type="number" placeholder="e.g., 10.5" {...field} /></FormControl>
                                        <FormMessage />
                                    </FormItem>
                                )}/>
                                <Button type="submit" disabled={isPending} className="w-full bg-green-600 hover:bg-green-700">
                                    {isPending ? <Loader2 className="animate-spin" /> : <TrendingUp />} Execute Pump
                                </Button>
                            </form>
                        </Form>
                    </CardContent>
                </Card>

                <Card>
                    <CardHeader>
                        <CardTitle className="flex items-center gap-2 text-destructive"><TrendingDown /> Dump</CardTitle>
                        <CardDescription>Execute a sell order to decrease token price.</CardDescription>
                    </CardHeader>
                    <CardContent>
                         <Form {...dumpForm}>
                            <form onSubmit={dumpForm.handleSubmit((values) => onActionSubmit(executeDump, values))} className="space-y-4">
                                <FormField control={dumpForm.control} name="tokenAddress" render={({ field }) => (
                                    <FormItem>
                                        <FormLabel>Token Contract Address</FormLabel>
                                        <FormControl><Input placeholder="Token address to sell" {...field} /></FormControl>
                                        <FormMessage />
                                    </FormItem>
                                )}/>
                                <FormField control={dumpForm.control} name="amount" render={({ field }) => (
                                    <FormItem>
                                        <FormLabel>Sell Amount (Token Units)</FormLabel>
                                        <FormControl><Input type="number" placeholder="e.g., 10000" {...field} /></FormControl>
                                        <FormMessage />
                                    </FormItem>
                                )}/>
                                <Button type="submit" disabled={isPending} variant="destructive" className="w-full">
                                    {isPending ? <Loader2 className="animate-spin" /> : <TrendingDown />} Execute Dump
                                </Button>
                            </form>
                        </Form>
                    </CardContent>
                </Card>
            </div>

            <Card>
                <CardHeader>
                    <CardTitle className="flex items-center gap-2 text-primary"><Repeat /> Wash Trading</CardTitle>
                    <CardDescription>Generate transaction volume with automated buy/sell orders between your wallets.</CardDescription>
                </CardHeader>
                <CardContent>
                    <Form {...washTradeForm}>
                        <form onSubmit={washTradeForm.handleSubmit((values) => onActionSubmit(executeWashTrade, values))} className="space-y-4">
                           <div className="grid md:grid-cols-3 gap-4">
                             <FormField control={washTradeForm.control} name="tokenAddress" render={({ field }) => (
                                <FormItem>
                                    <FormLabel>Token Contract Address</FormLabel>
                                    <FormControl><Input placeholder="Token address" {...field} /></FormControl>
                                    <FormMessage />
                                </FormItem>
                            )}/>
                            <FormField control={washTradeForm.control} name="tradeCount" render={({ field }) => (
                                <FormItem>
                                    <FormLabel>Number of Trades</FormLabel>
                                    <FormControl><Input type="number" placeholder="e.g., 100" {...field} /></FormControl>
                                    <FormMessage />
                                </FormItem>
                            )}/>
                             <FormField control={washTradeForm.control} name="tradeAmount" render={({ field }) => (
                                <FormItem>
                                    <FormLabel>Amount Per Trade</FormLabel>
                                    <FormControl><Input type="number" placeholder="e.g., 500" {...field} /></FormControl>
                                    <FormMessage />
                                </FormItem>
                            )}/>
                           </div>
                            <Button type="submit" disabled={isPending} variant="secondary" className="w-full">
                                {isPending ? <Loader2 className="animate-spin" /> : <Repeat />} Start Wash Trading
                            </Button>
                        </form>
                    </Form>
                </CardContent>
            </Card>

        </div>
      </main>
    </div>
  );
}
