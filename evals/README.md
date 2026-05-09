# AI Glossary Evaluation Framework

This framework tests how accurately AI models explain AI concepts in Arabic compared to a ground truth dataset. It uses an **LLM-as-a-judge** approach to automatically score the outputs.

## Setup

1. **Install Dependencies:**
   ```bash
   cd evals
   pip install -r requirements.txt
   ```

2. **Configure API Keys:**
   Create a `.env` file in the `evals` directory and add your API keys. Since the framework uses `litellm`, you can provide keys for whichever models you intend to use.
   ```env
   GEMINI_API_KEY=your_gemini_api_key
   # If you use other models, add their keys as well, e.g.:
   # GROQ_API_KEY=your_groq_api_key
   # OPENAI_API_KEY=your_openai_api_key
   ```

## Usage

Run the benchmark using the CLI script. By default, it uses `gemini/gemini-2.5-flash` as the target model (the one taking the test) and `gemini/gemini-3.1-flash-lite` as the judge (with `gemini/gemma-3-27b` as a fallback if rate limits are hit).

```bash
# Run a small test with 5 samples
python run_benchmark.py --samples 5

# Run with different models and save as JSON
python run_benchmark.py --target-model groq/llama3-8b-8192 --judge-model gemini/gemini-3.1-flash-lite --samples 50 --output results/my_test.json

# Run on the entire dataset (might take a long time and use many API calls!)
python run_benchmark.py --samples 0
```

## How It Works

1. **Prompting the Target Model:** The framework takes an English AI term from the dataset and asks the target model: *"Explain the concept '{term}' in Arabic in short."*
2. **Scoring with the Judge Model:** The framework then provides the ground truth Arabic definition and the target model's generated explanation to the judge model. The judge model scores the explanation from 1 to 5 based on how accurately it matches the ground truth.
3. **Fallback Mechanism:** If the judge model hits a rate limit, the framework automatically tries the fallback judge model (e.g., Gemma 3 27B) to continue the evaluation without crashing.
4. **Export:** The results are saved to a CSV or JSON file in the `results/` folder for analysis.
