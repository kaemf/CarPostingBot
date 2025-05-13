export default async function UnknownFieldHandler(set: any, inputResultFinalJSON: string, workWithField: string, value: string) {
    console.log(`UnknownFieldHandler: ${workWithField} = ${value}`);
    const data = JSON.parse(inputResultFinalJSON);

    data.Valid[workWithField] = value;
    const index = data.Unknown.indexOf(workWithField);

    if (index !== -1) {
        data.Unknown.splice(index, 1);
    }

    await set('finalResult')(JSON.stringify(data));
}