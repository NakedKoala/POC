import { readFile } from "mz/fs";
import { Connection, Keypair } from "@solana/web3.js";
import { getOrca, OrcaPoolConfig, Orca, OrcaPool, OrcaPoolToken, OrcaU64 } from "@orca-so/sdk";
import Decimal from "decimal.js";
import {createObjectCsvWriter} from "csv-writer"

function sleep(ms:number) {
    return new Promise((resolve) => {
      setTimeout(resolve, ms);
    });
}

const createCSVHeader = (pool: OrcaPool, trade_sizes: Decimal[]) => {
    const tokenA = pool.getTokenA();
    const tokenB = pool.getTokenB();
    let dataColumns = trade_sizes.map(trade_size => {
       const aToBStr = `${tokenA.tag}->${tokenB.tag}@${trade_size}` 
       const bToAStr = `${tokenB.tag}->${tokenA.tag}@${trade_size}` 
       return [ 
        {id: aToBStr, title: aToBStr}, 
        {id: bToAStr, title: bToAStr}, 
       ]
    });
    return [{id: "block", title: "block"}, {id: "timestamp", title: "timestamp"}].concat(dataColumns.flat());
}

interface csvRow {
    [key: string]: string | number
}

const collectPairQuotes = async (orca: Orca, pair: OrcaPoolConfig, trade_sizes: Decimal[]) => {
    const pool = orca.getPool(pair);
    const tokenA = pool.getTokenA();
    const tokenB = pool.getTokenB();
    const csvWriter = createObjectCsvWriter({
        path: `${tokenA.tag}_${tokenB.tag}.csv`,
        header: createCSVHeader(pool, trade_sizes)
    });
    
    let rowObject: csvRow;
    for(;;){
        rowObject = {
            block: "*",
            timestamp: new Date().toISOString(),
        }
        for (let size of trade_sizes){
            const aToBQuote = await pool.getQuote(tokenA, size, new Decimal(0));
            const bToAQuote = await pool.getQuote(tokenB, size, new Decimal(0));
            const aToBCol:string = `${tokenA.tag}->${tokenB.tag}@${size}`;
            const bToACol:string = `${tokenB.tag}->${tokenA.tag}@${size}`;
            rowObject[aToBCol] = aToBQuote.getExpectedOutputAmount().toNumber();
            rowObject[bToACol] = bToAQuote.getExpectedOutputAmount().toNumber();
            await sleep(1000);
        }
        console.log(`writing row for ${tokenA.tag}_${tokenB.tag} to csv.`)
        await csvWriter.writeRecords([rowObject]);
        await sleep(5000);
    }
  
}

const main = () => {

  const connection = new Connection("https://api.mainnet-beta.solana.com", "singleGossip");
  const orca = getOrca(connection);
  collectPairQuotes(orca, OrcaPoolConfig.mSOL_SOL, [new Decimal(1), new Decimal(10), new Decimal(100), new Decimal(1000)]);
  collectPairQuotes(orca, OrcaPoolConfig.scnSOL_SOL, [new Decimal(1), new Decimal(10), new Decimal(100), new Decimal(1000)]);
};

main()