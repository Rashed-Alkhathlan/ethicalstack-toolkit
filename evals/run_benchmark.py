import os
import json
import argparse
import pandas as pd
from tqdm import tqdm
from dotenv import load_dotenv
from evaluator import LLMEvaluator

def load_data(file_path: str, samples: int = None):
    with open(file_path, 'r', encoding='utf-8') as f:
        data = json.load(f)
    if samples and samples > 0:
        return data[:samples]
    return data

def main():
    parser = argparse.ArgumentParser(description="Run AI Glossary Evaluation Benchmark")
    parser.add_argument("--data", type=str, default="../data/glossary.json", help="Path to glossary dataset")
    parser.add_argument("--target-model", type=str, default="groq/openai/gpt-oss-safeguard-20b", help="Model taking the test")
    parser.add_argument("--judge-model", type=str, default="groq/openai/gpt-oss-safeguard-20b", help="Judge model")
    parser.add_argument("--fallback-judge", type=str, default="gemini/gemma-3-27b", help="Fallback judge model for rate limits")
    parser.add_argument("--samples", type=int, default=10, help="Number of terms to evaluate (0 for all)")
    parser.add_argument("--output", type=str, default="results/benchmark_results.csv", help="Path to save results")
    args = parser.parse_args()

    load_dotenv()

    print(f"Loading data from {args.data}...")
    data = load_data(args.data, args.samples)
    print(f"Loaded {len(data)} items.")

    evaluator = LLMEvaluator(
        target_model=args.target_model,
        judge_model=args.judge_model,
        fallback_judge_model=args.fallback_judge
    )

    results = []
    print(f"Running evaluation on target: {args.target_model} using judge: {args.judge_model}...")
    
    for item in tqdm(data, desc="Evaluating terms"):
        term = item.get("english_term", "")
        ground_truth = item.get("arabic_def", "")
        
        if not term or not ground_truth:
            continue
            
        explanation = evaluator.generate_explanation(term)
        score = evaluator.score_explanation(term, explanation, ground_truth)
        
        results.append({
            "term": term,
            "ground_truth": ground_truth,
            "generated_explanation": explanation,
            "score": score
        })

    os.makedirs(os.path.dirname(args.output), exist_ok=True)
    df = pd.DataFrame(results)
    
    if args.output.endswith('.json'):
        df.to_json(args.output, orient='records', force_ascii=False, indent=2)
    else:
        df.to_csv(args.output, index=False, encoding='utf-8')
    
    avg_score = df['score'].mean() if not df.empty else 0
    print(f"\nEvaluation complete!")
    print(f"Results saved to {args.output}")
    print(f"Average Score: {avg_score:.2f} / 5.0")

if __name__ == "__main__":
    main()
