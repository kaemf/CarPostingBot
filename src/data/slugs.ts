const slugs = [
    {"term_id":"4","name":"Acura","slug":"acura"},
    {"term_id":"5","name":"Alfa Romeo","slug":"alfa-romeo"},
    {"term_id":"7","name":"Aston Martin","slug":"aston-martin"},
    {"term_id":"8","name":"Audi","slug":"audi"},
    {"term_id":"10","name":"Bentley","slug":"bentley"},
    {"term_id":"11","name":"BMW","slug":"bmw"},
    {"term_id":"12","name":"Buick","slug":"buick"},
    {"term_id":"13","name":"Cadillac","slug":"cadillac"},
    {"term_id":"14","name":"Chevrolet","slug":"chevrolet"},
    {"term_id":"15","name":"Chrysler","slug":"chrysler"},
    {"term_id":"16","name":"Dodge","slug":"dodge"},
    {"term_id":"17","name":"Ferrari","slug":"ferrari"},
    {"term_id":"18","name":"FIAT","slug":"fiat"},
    {"term_id":"20","name":"Ford","slug":"ford"},
    {"term_id":"21","name":"Genesis","slug":"genesis"},
    {"term_id":"22","name":"GMC","slug":"gmc"},
    {"term_id":"23","name":"Honda","slug":"honda"},
    {"term_id":"24","name":"Hummer","slug":"hummer"},
    {"term_id":"25","name":"Hyundai","slug":"hyundai"},
    {"term_id":"27","name":"INFINITI","slug":"infiniti"},
    {"term_id":"28","name":"Jaguar","slug":"jaguar"},
    {"term_id":"29","name":"Jeep","slug":"jeep"},
    {"term_id":"31","name":"Kia","slug":"kia"},
    {"term_id":"32","name":"Lamborghini","slug":"lamborghini"},
    {"term_id":"33","name":"Land Rover","slug":"land-rover"},
    {"term_id":"34","name":"Lexus","slug":"lexus"},
    {"term_id":"35","name":"Lincoln","slug":"lincoln"},
    {"term_id":"36","name":"Lotus","slug":"lotus"},
    {"term_id":"38","name":"Maserati","slug":"maserati"},
    {"term_id":"39","name":"Mazda","slug":"mazda"},
    {"term_id":"40","name":"McLaren","slug":"mclaren"},
    {"term_id":"41","name":"Mercedes-Benz","slug":"mercedes-benz"},
    {"term_id":"43","name":"MINI","slug":"mini"},
    {"term_id":"44","name":"Mitsubishi","slug":"mitsubishi"},
    {"term_id":"45","name":"Nissan","slug":"nissan"},
    {"term_id":"49","name":"Pontiac","slug":"pontiac"},
    {"term_id":"50","name":"Porsche","slug":"porsche"},
    {"term_id":"51","name":"RAM","slug":"ram"},
    {"term_id":"53","name":"Rolls-Royce","slug":"rolls-royce"},
    {"term_id":"54","name":"Saab","slug":"saab"},
    {"term_id":"58","name":"Smart","slug":"smart"},
    {"term_id":"59","name":"Subaru","slug":"subaru"},
    {"term_id":"60","name":"Suzuki","slug":"suzuki"},
    {"term_id":"61","name":"Tesla","slug":"tesla"},
    {"term_id":"62","name":"Toyota","slug":"toyota"},
    {"term_id":"64","name":"Volkswagen","slug":"volkswagen"},
    {"term_id":"65","name":"Volvo","slug":"volvo"},
    {"term_id":"66","name":"SUV","slug":"suv"},
    {"term_id":"67","name":"Truck","slug":"truck"},
    {"term_id":"68","name":"Sedan","slug":"sedan"},
    {"term_id":"69","name":"Coupe","slug":"coupe"},
    {"term_id":"70","name":"Minivan","slug":"minivan"},
    {"term_id":"72","name":"Hatchback","slug":"hatchback"},
    {"term_id":"73","name":"Convertible","slug":"convertible"},
    {"term_id":"74","name":"Wagon","slug":"wagon"},
    {"term_id":"75","name":"Diesel","slug":"diesel"},
    {"term_id":"76","name":"Gasoline","slug":"gasoline"},
    {"term_id":"77","name":"Electric","slug":"electric"},
    {"term_id":"78","name":"Hybrid","slug":"hybrid"},
    {"term_id":"91","name":"Automatic","slug":"automatic"},
    {"term_id":"92","name":"Manual","slug":"manual"}
]

function levenshtein(a: string, b: string): number {
  const matrix = Array.from({ length: b.length + 1 }, (_, i) => [i]);

  for (let j = 0; j <= a.length; j++) {
    matrix[0][j] = j;
  }

  for (let i = 1; i <= b.length; i++) {
    for (let j = 1; j <= a.length; j++) {
      matrix[i][j] = Math.min(
        matrix[i - 1][j] + 1,
        matrix[i][j - 1] + 1,
        matrix[i - 1][j - 1] + (a[j - 1] === b[i - 1] ? 0 : 1)
      );
    }
  }

  return matrix[b.length][a.length];
}

export default function GetAxonomy(input: string): number {
  const inputNormalized = input.toLowerCase();

  for (const el of slugs) {
    if (el.slug.toLowerCase().includes(inputNormalized)) {
      return parseInt(el.term_id);
    }
  }

  let bestMatch: { slug: string; distance: number } | null = null;

  for (const { slug } of slugs) {
    const dist = levenshtein(inputNormalized, slug.toLowerCase());
    if (!bestMatch || dist < bestMatch.distance) {
      bestMatch = { slug, distance: dist };
    }
  }

  if (bestMatch && bestMatch.distance <= 4) {
    return parseInt(slugs.find((el) => el.slug === bestMatch!.slug)?.term_id || "-1");
  }

  return -1;
}