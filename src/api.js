const express = require('express')
const serverless = require('serverless-http')
const cors = require('cors')
const events = require('events')
const axios = require("axios");

const emitter = new events.EventEmitter()

const PORT = 5000
const api = express()

const router = express.Router()
api.use(cors())
api.use(express.json())


router.get('/', (req, res) => {
  res.json({message: "wowokkkkk"})
})

router.post('/getTest', (req, res) => {
    // создаем слушатель на newJson - в emit вернём json
    emitter.once('newJson', (json) => {
        res.json(json)
    })

    const token = req.headers.authorization

    // list
    let list = null

    let send = {
        T_proteine:  +req.body.T_proteine,
        T_grassi: +req.body.T_grassi,
        T_carboidrati: +req.body.T_carboidrati
    }

    //vars
    let block = false

    let sum_proteine = 0
    let sum_grassie = 0
    let sum_carboidrati = 0
    let sum_energia = 0

    let slicePage = 1
    let lenht = 6
    let pracent = 0.03

    let hightLine = 1.1
    let bottomLine = 0.9

    let inerationsLen = 0
    let valueResponseList = 0

    function getList() {
        block = false
        lenht = 6
        pracent = 0.02
        inerationsLen = 0
        valueResponseList = valueResponseList + 1
        return new Promise((resolve, reject) => {
            axios.post('https://fespa-2.568325project-cr-date2251.xyz/api/dish/generated_men', {
                T_carboidrati: +send.T_carboidrati,
                T_grassi: +send.T_grassi,
                T_proteine: +send.T_proteine
            }, {
                headers: {
                    Authorization: token
                }
            }).then((res) => {
                if (res.data.msg) {
                    list = res.data.list

                    setTimeout(() => {
                        console.log('init')
                        checkSum()
                        showSum()

                        if (valueResponseList === 1){
                            startCycle()
                        }
                        resolve()
                    }, 500)
                }else{
                    emitter.emit('newJson', res.data)
                }
            }).catch((res) => {
                emitter.emit('newJson', res)
            })
        })
    }
    getList()

    function checkSum() {
        const item = Object.keys(list);

        // обнулим сумму
        sum_carboidrati = 0
        sum_grassie = 0
        sum_proteine = 0
        sum_energia = 0

        // перебираем все ключи с продуктами
        item.forEach(key => {
            // перебираем продукты
            list[key].forEach(product => {
                sum_carboidrati = sum_carboidrati + product.T_carboidrati
                sum_grassie = sum_grassie + product.T_grassi
                sum_proteine = sum_proteine + product.T_proteine
                sum_energia = sum_energia + product.T_energia
            })
        })
    }

    function showSum(){
        console.log({
            sum_proteine,
            sum_grassie,
            sum_carboidrati,
            sum_energia,
        })
    }

    function minVal(arr) {
        let min = arr[0].val
        let minItem = {}

        arr.forEach(item => {
            if (item.val < min) {
                min = item.val
                minItem = item
            }
        })
        return minItem
    }

    function typeInKey(type) {
        switch (type) {
            case 'sum_proteine':
                return 'T_proteine'
            case 'sum_grassie':
                return 'T_grassi'
            case 'sum_carboidrati':
                return 'T_carboidrati'
        }
    }

    function  middleVal(item, type) {
        let lenType = 0
        let sumType = 0

        item.forEach(key => {
            list[key].forEach(product => {
                lenType = lenType + 1
                sumType = product[type] + sumType
            })
        })
        return sumType / lenType
    }

    function iteration(type, sumKey, sumKeyValue) {
        if (block) {
            return
        }

        const item = Object.keys(list);
        const keys = [
            'T_carboidrati',
            'T_energia',
            'T_grassi',
            'T_proteine',
            'T_weight',
        ]

        let fiveBigItems = []

        // минимальное значение из всех sum_
        const minItem = minVal([{
            val: sum_proteine,
            key: 'sum_proteine'
        }, {
            val: sum_grassie,
            key: 'sum_grassie'
        }, {
            val: sum_carboidrati,
            key: 'sum_carboidrati'
        }])

        // middle values types
        const middleValues = []
        keys.forEach(key => {
            middleValues.push({
                key,
                val: middleVal(item, key)
            })
        })

        // получим все значения
        item.forEach(key => {
            list[key].forEach(product => {
                fiveBigItems.push(product)
            })
        })

        // получим значения которых больше средних
        fiveBigItems = sort(fiveBigItems, middleValues, type, minItem)


        fiveBigItems.forEach(bigItem => {
            item.forEach(key => {
                // получаем элемент равный значению из bigListVaslues
                const findItem = list[key].find(product => product[type] === bigItem[type])

                if (findItem) {
                    if (sumKeyValue > send[type]) {
                        keys.forEach(nameKey => {
                            findItem[nameKey] = +(findItem[nameKey] * (1 - +pracent)).toFixed(1)
                        })
                    } else {
                        keys.forEach(nameKey => {
                            findItem[nameKey] = +(findItem[nameKey] * (1 + +pracent)).toFixed(1)
                        })
                    }
                }
            })
        })
        checkSum()
    }

    function sort(list, middleVal, priorityType, minItem) {
        const newArr = []

        list.forEach(item => {
            const findVal = middleVal.find(item => item.key === priorityType)
            const findMinVal = middleVal.find(item => item.key === typeInKey(minItem.key))

            if (findVal) {
                if (item[priorityType] > findVal.val) {
                    if (findMinVal) {
                        if (item[typeInKey(minItem.key)] < findMinVal.val * 0.8) {
                            newArr.push(item)
                        }
                    }
                }
            }
        })

        if (newArr.length > 0) {
            return newArr
        } else {
            const listSortable = list.sort(function (a, b) {
                if (a[priorityType] < b[priorityType]) {
                    return -1
                }
                if (a[priorityType] > b[priorityType]) {
                    return 1
                }
                return 0
            })
            return listSortable.slice(-lenht)
        }
    }

    function startCycle() {
        if (valueResponseList > 20) {
            checkSum()
            emitter.emit('newJson', {
                result: 'not-found',
                countGet: valueResponseList,
                sum: {
                    sum_proteine,
                    sum_grassie,
                    sum_carboidrati,
                    sum_energia,
                },
                json: ''
            })
            return
        }

        for (let i = 0; i < 10; i++) {
            cycle()
        }
        if (block) {
            if (checkValues()) {
                sendResult()
            } else {
                getList().then(() => {
                    startCycle()
                })
            }
        } else {
            getList().then(() => {
                startCycle()
            })
        }
    }
    function sendResult() {
        emitter.emit('newJson', {
            result: 'good',
            countGet: valueResponseList,
            sum: {
                sum_proteine,
                sum_grassie,
                sum_carboidrati,
                sum_energia,
            },
            json: JSON.stringify(list)
        })
    }
    function checkValues() {
        if (sum_carboidrati > send.T_carboidrati * hightLine || sum_carboidrati < send.T_carboidrati * bottomLine) {
            console.log('bad - sum_carboidrati')
            return false
        }
        if (sum_grassie > send.T_grassi * hightLine || sum_grassie < send.T_grassi * bottomLine) {
            console.log('bad - sum_grassie')
            return false
        }
        if (sum_proteine > send.T_proteine * hightLine || sum_proteine < send.T_proteine * bottomLine) {
            console.log('bad - sum_proteine')
            return false
        }
        console.log('good values++')
        return true
    }

    function cycle() {
        inerationsLen = inerationsLen + 1

        if (inerationsLen > 4) {
            lenht = lenht + 1
        } else {
            lenht = lenht - 1
        }

        if (pracent < 0.3 && inerationsLen < 30) {
            pracent = pracent + 0.012
        } else {
            pracent = pracent - 0.012
        }


        let i = 1000

        while (i) {
            start()
            checkSum()
            i--;
        }

    }

    function start(){
        if (block) {
            return
        }

        if (sum_carboidrati > send.T_carboidrati * hightLine || sum_carboidrati < send.T_carboidrati * bottomLine) {
            iteration('T_carboidrati', 'sum_carboidrati', sum_carboidrati)
        } else if (sum_grassie > send.T_grassi * hightLine || sum_grassie < send.T_grassi * bottomLine) {
            iteration('T_grassi', 'sum_grassie', sum_grassie)
        } else if (sum_proteine > send.T_proteine * hightLine || sum_proteine < send.T_proteine * bottomLine) {
            iteration('T_proteine', 'sum_proteine', sum_proteine)
        } else {
            block = true
            checkSum()
        }
    }
})

api.use('/.netlify/functions/api',router)

module.exports.handler = serverless(api);

// api.listen(PORT, () => console.log(`server start ${PORT}`))
